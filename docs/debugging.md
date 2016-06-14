#Debugging TypeScript Tasks in VS Code

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

Now run a gulp build.

Next, create a launch.json file -- goto the debug section in VS Code, and click the gear icon, this will create a .vscode/launch.json file.

Edit the file as necessary.  You can run straigth from the _build/Tasks, folder for the task you wish to debug, or you can copy the build artifacts into the Task itself and run from there, if you choose the copy rought (as I do), you will need to copy node_modules, and the generated .js and .js.map, along with any other build artifacts (e.g. in Archive files, 7zip).  After the first build, assuming no structural changes are made, you will only need to copy the .js and .js.map files for subsequent builds.

Here it will run the ArchiveFiles task with the specified input arguments:

<pre>
        {
            "name": "Launch tar.gz",
            "type": "node",
            "request": "launch",
            "program": "C:\\git\\github\\vsts-tasks\\Tasks\\ArchiveFiles\\archivefiles.js",
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
                "INPUT_rootFolder" : "C:\\agents\\latest\\_work\\21\\s",
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