# Debugging TypeScript Tasks in VS Code

Start by changing the build scripts to generate the required source mappings files.  In the root of the repo, edit the tsconfig.json folder to add sourceMaps, e.g.
<pre>
{
    "compilerOptions": {
        "target": "ES6",
        "module": "commonjs",
        "sourceMap":true
    }
}
</pre>

Now build the sources.

Next, create a launch.json file -- go to the debug section in VS Code, and click the gear icon, this will create a .vscode/launch.json file.

Edit the file as necessary.  You can run straight from the _build/Tasks, folder for the task you wish to debug, or you can copy the build artifacts into the Task itself and run from there.  If you choose the copy route, you will need to copy node_modules, and the generated .js and .js.map, along with any other build artifacts (e.g. in ArchiveFiles, 7zip), and this will allow you to debug directly from your source.  After the first build & copy, assuming no structural changes are made, you will only need to copy the .js and .js.map files for subsequent builds.

Here it will run the ArchiveFiles task with the specified input arguments:

<pre>
        {
            "name": "Launch tar.gz",
            "type": "node",
            "request": "launch",
            "program": "C:\\git\\github\\vsts-tasks\\Tasks\\ArchiveFiles\\archivefiles.ts",
            "stopOnEntry": false,
            "args": [],
            "cwd": "C:\\git\\github\\vsts-tasks\\_build\\Tasks\\ArchiveFiles\\",
            "preLaunchTask": null,
            "runtimeExecutable": null,
            "runtimeArgs": [
                "--nolazy"
            ],
            "env": {
                "NODE_ENV": "development",
                "INPUT_rootFolderOrFile" : "C:\\agents\\latest\\_work\\21\\s",
                "INPUT_includeRootFolder" : true,
                "INPUT_archiveType": "tar",
                "INPUT_tarCompression": "gz",
                "INPUT_archiveFile": "c:\\temp\\test.tar.gz",
                "INPUT_replaceExistingArchive": "true",
                "BUILD_SOURCESDIRECTORY": "C:\\agents\\latest\\_work\\21\\s"
            },
            "externalConsole": false,
            "sourceMaps": true,
            "outDir": "${workspaceRoot}\\_build\\Tasks\\ArchiveFiles\\"
        }
</pre>

I've run into some issues with line numbers not matching directly between the typescript and generated javascript when debugging which pretty much makes the debugger unusable.  Being unable to get around this issue at the moment, I'm sadly back to console.log(), but at least this launch file will allow you to run from within VSCode.  
