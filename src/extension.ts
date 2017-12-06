'use strict';

import * as vscode from 'vscode';
import { basename, dirname, join } from 'path';
import * as SftpClient from 'ssh2-sftp-client';
import { userInfo } from 'os';

export function activate(context: vscode.ExtensionContext) {
    let folders = vscode.workspace.workspaceFolders;
    for (const folder of folders) {
        if (folder.uri.scheme == 'sftp') {
            let provider = new SftpFileSystemProvider();
            provider.registerUri(folder.uri);
            let disposable = vscode.workspace.registerFileSystemProvider('sftp', provider);
            context.subscriptions.push(disposable);
        }
    }
}

function _FileType(str: string): vscode.FileType {
    if (str === "d") {
        return vscode.FileType.Dir;
    } else if (str == '-') {
        return vscode.FileType.File;
    } else if (str == 'l') {
        return vscode.FileType.Symlink;
    }
}

enum _ConnectionStates {
    Unknown = 0,
    Connecting,
    Connected,
    Failed,
}

class SftpFileSystemProvider implements vscode.FileSystemProvider {
    public root: vscode.Uri;

    private _user: string;
    private _pass: string;
    private _host: string;
    private _port: number;
    private _connection: SftpClient;
    private _connectionState: _ConnectionStates;
    private _pending: { resolve: Function, reject: Function, func: keyof SftpClient, args: any[] }[] = [];

    constructor() {
        this._connectionState = _ConnectionStates.Unknown;
    }

    public registerUri(uri : vscode.Uri) {
        this.root = uri;
        this._user = userInfo().username;
        this._port = 22;
        let host = this.root.authority;
        if (host.includes(":")) {
            let authParts = host.split(":", 2);
            host = authParts[0];
            this._port = Number.parseInt(authParts[1]);
        }
        if (host.includes("@")) {
            let hostParts = host.split("@", 2);
            this._user = hostParts[0];
            host = hostParts[1];
        }
        this._host = host;
        console.log("Registerered FileSystemProvider for: " + this._user + "@" + this._host + ":" + this._port);
    }

    private _withConnection<T>(func: keyof SftpClient, ...args: any[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this._pending.push({ resolve, reject, func, args });
            this._nextRequest();
        });
    }

    private _nextRequest(): void {
        if (this._pending.length === 0) {
            return;
        }

        if (this._connectionState === _ConnectionStates.Connecting) {
            return;
        }

        if (this._connectionState === _ConnectionStates.Unknown) {
            this._connectionState = _ConnectionStates.Connecting;
            console.log('Retrieving user input: password.')
            let passwordPrompt = "Password for " + this.root.authority;
            vscode.window.showInputBox({ prompt: passwordPrompt, password: true }).then((pass) => {
                this._pass = pass;
                console.log('Attempting to connect to ' + this._user + '@' + this._host + ':' + this._port);
                let sftp = new SftpClient();
                sftp.connect({
                    host: this._host,
                    port: this._port,
                    username: this._user,
                    password: this._pass
                }).then(() => {
                    console.log('Connection attempt succeeded!')
                    this._connection = sftp;
                    this._connectionState = _ConnectionStates.Connected;
                    this._nextRequest();
                }).catch((err) => {
                    console.error('Connection attempt failed! ' + err);
                    this._connection = null;
                    this._connectionState = _ConnectionStates.Failed;
                    this._nextRequest();
                });
            });
            return;
        }

        if (this._connectionState === _ConnectionStates.Failed) {
            vscode.window.showErrorMessage('Failed to connect to sftp server.', ...['Retry', 'Cancel']).then((str) => {
                if (str === 'Cancel') {
                    console.error('Aborting connection attempt per user request!');
                    for (let request of this._pending) {
                        request.reject(new Error('Failed to connect to sftp server.'));
                    }
                    this._pending = new Array();
                    return;
                }
                console.error('Retrying connection per user request!');
                this._connectionState = _ConnectionStates.Unknown;
                this._nextRequest();
            });
            return;
        }

        if (this._connectionState === _ConnectionStates.Connected) {
            const { func, args, resolve, reject } = this._pending.shift();
            console.log('Processing ' + func + ' request: ' + args);
            this._connection[func].apply(this._connection, args).then((res) => {
                resolve(res);
            }).catch((err) => {
                console.log('Rejected ' + func + ' request: ' + args + ' with err: ' + err);
                reject(err);
            });
            this._nextRequest();
            return;
        }
    }

    dispose(): void {
        this._withConnection('end')
    }

    utimes(resource: vscode.Uri, mtime: number): Promise<vscode.FileStat> {
        return this.stat(resource);
    }

    stat(resource: vscode.Uri): Promise<vscode.FileStat> {
        const { path } = resource;
        if (path === this.root.path || path === '') {
            return Promise.resolve(<vscode.FileStat>{
                type: vscode.FileType.Dir,
                id: null,
                mtime: 0,
                size: 0
            });
        }

        const name = basename(path);
        const dir = dirname(path);
        return this._withConnection<SftpClient.FileInfo[]>('list', dir).then(entries => {
            for (const entry of entries) {
                if (entry.name === name) {
                    return {
                        id: null,
                        mtime: entry.modifyTime,
                        size: entry.size,
                        type: _FileType(entry.type)
                    }
                }
            }
            return Promise.reject<vscode.FileStat>(new Error(`ENOENT, ${resource.toString(true)}`));
        }, err => {
            return Promise.reject<vscode.FileStat>(new Error(`ENOENT, ${resource.toString(true)}`));
        });
    }

    readdir(dir: vscode.Uri): Promise<[vscode.Uri, vscode.FileStat][]> {
        return this._withConnection<SftpClient.FileInfo[]>('list', dir.path).then(entries => {
            const result: [vscode.Uri, vscode.FileStat][] = [];
            for (let entry of entries) {
                const resource = dir.with({ path: join(dir.path, entry.name) });
                // FIXME(khimaros): Figure out how to properly support symlinks with ssh2-sftp-client.
                // Currently, attempting to stat a symlink returns an error.
                if (_FileType(entry.type) == vscode.FileType.Symlink) { continue }
                const stat: vscode.FileStat = {
                    id: resource.toString(),
                    mtime: entry.modifyTime,
                    size: entry.size,
                    type: _FileType(entry.type)
                }
                result.push([resource, stat]);
            }
            return result;
        });
    }

    read(resource: vscode.Uri, offset: number = 0, len: number, progress: vscode.Progress<Uint8Array>): Promise<number> {
        return this._withConnection<NodeJS.ReadableStream>('get', resource.path, true).then((stream => {
            let bytesRead = 0;
            return new Promise<number>((resolve, reject) => {
                stream.on('data', buffer => {
                    progress.report(Buffer.from(buffer));
                    bytesRead += buffer.length;
                    if (len > 0 && bytesRead > len) {
                        stream.removeAllListeners();
                    }
                });
                stream.on('end', hadErr => {
                    if (hadErr) {
                        reject(hadErr);
                    } else {
                        console.log('Read ' + bytesRead + ' bytes from ' + resource.path);
                        resolve(bytesRead);
                    }
                });
                stream.resume();
            });
        }));
    }

    write(resource: vscode.Uri, content: Uint8Array): Promise<void> {
        return this._withConnection('put', content, resource.path);
    }

    rmdir(resource: vscode.Uri): Promise<void> {
        return this._withConnection('rmdir', resource.path, true);
    }

    mkdir(resource: vscode.Uri): Promise<vscode.FileStat> {
        return this._withConnection('mkdir', resource.path)
            .then(() => this.stat(resource));
    }

    unlink(resource: vscode.Uri): Promise<void> {
        return this._withConnection('delete', resource.path);
    }

    move(resource: vscode.Uri, target: vscode.Uri): Promise<vscode.FileStat> {
        return this._withConnection('rename', resource.path, target.path).then(() => {
            return this.stat(target);
        });
    }
}
