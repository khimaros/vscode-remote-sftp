# vscode-remote-sftp

Visual Studio Code extension which implements a FileSystemProvider for SFTP. This allows SFTP filesystems to be used just like native filesystems.

This extension utilizes the **proposed** remote fileystem API, which is subject to change without notice.

# Quick start

* Download the [VSIX extension](https://src.rabidgeek.com/rabidgeek/vscode-remote-sftp/raw/master/vscode-remote-sftp-0.0.1.vsix) and install it.
* Create a new code-workspace file, in this example we will use `remote.code-workspace`.
* Add the following to `remote.code-workspace` file (replace `<user>` etc with the correct values):

```
{
	"folders": [
		{
    		"uri": "sftp://<user>@<host>:<port>/<path>"
		}
	],
	"settings": {}
}
```

* File > Open Workspace and select your `remote.code-workspace`.

You will be prompted for your SFTP server password, enter it.

Now you should see files and folders from your SFTP server in the explorer.

# Preparing development environment

* Install Visual Studio Code Insiders.
* Launch Code Insiders with `code-insiders --enable-proposed-api khimaros.vscode-remote-sftp`.
* Install the NPM extension `eg2.vscode-npm-script` and Reload Window.
* View > Command Palette: `> npm install`.

# Running extension in debugger

* Tasks > Run Task: `npm compile`.
* Press F5 to start a new instance of VS Code with the extension loaded.

# Building the VSIX package

* Ctrl-+: `./node_modules/vsce/out/vsce package`

# Proposed API vendoring

Pull in the latest vscode.proposed.d.ts:

https://github.com/Microsoft/vscode/commits/5ecc577420b7ad266966861803e160d2ea33a889/src/vs/vscode.proposed.d.ts