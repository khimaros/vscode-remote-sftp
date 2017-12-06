# vscode-sftp-filesystem

This is a sample that uses SFTP to implement a file system provider in VS Code. This API depends on the remote fileystem API which is currently a proposed API.

# Quick start

First set up your extension development environment:

* Install the Code Insiders nightly
* Start Code Insiders with `code-insiders --enable-proposed-api khimaros.sftp-filesystem`
* Install the NPM extension `eg2.vscode-npm-script` and reload your window
* View > Command Palett: `> npm install`
* Tasks > Run Task: `npm compile`

Now we need to create a code-workspace config:

* Create a new file named eg. remote-workspace.code-workspace
* Add the following to your code-workspace file (replace <user> etc with the correct values):

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

Now you can launch a development instance:

* Press F5 to start a new instance of VS Code
* File > Open Workspace and select your remote-workspace.code-workspace

You will be prompted for a password, enter it.

Now you should see files and folders from your sftp-server showing up in the explorer. 

# Development

Pull in the latest vscode.proposed.d.ts:

https://github.com/Microsoft/vscode/commits/5ecc577420b7ad266966861803e160d2ea33a889/src/vs/vscode.proposed.d.ts