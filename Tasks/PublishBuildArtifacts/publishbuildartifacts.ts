/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import os = require('os');
import path = require('path');
var process = require('process');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

// used for escaping file paths that are passed into the powershell command
let pathToPSString = (filePath: string) => {
    let result: string =
        filePath.replace(/"/g, '') // remove double quotes
        .replace(/'/g, "''"); // double-up single quotes
    return `'${result}'`; // enclose in single quotes
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // PathtoPublish is a folder that contains the files
        let pathtoPublish: string = tl.getPathInput('PathtoPublish', true, true);
        let artifactName: string = tl.getInput('ArtifactName', true);
        let artifactType: string = tl.getInput('ArtifactType', true);

        artifactType = artifactType.toLowerCase();
        let data = {
            artifacttype: artifactType,
            artifactname: artifactName
        };

        // upload or copy
        if (artifactType === "container") {
            data["containerfolder"] = artifactName;

            // add localpath to ##vso command's properties for back compat of old Xplat agent
            data["localpath"] = pathtoPublish;
            tl.command("artifact.upload", data, pathtoPublish);
        }
        else if (artifactType === "filepath") {
            let targetPath: string = tl.getInput('TargetPath', true);
            let artifactPath: string = path.join(targetPath, artifactName);
            data['artifactlocation'] = targetPath; // artifactlocation for back compat with old xplat agent

            if (os.platform() == 'win32') {
                tl.mkdirP(artifactPath);

                // create the artifact. at this point, mkdirP already succeeded so the path is good.
                // the artifact should get cleaned up during retention even if the copy fails in the
                // middle
                tl.command("artifact.associate", data, targetPath);

                // copy the files
                let script: string = path.join(__dirname, 'Invoke-Robocopy.ps1');
                let command: string = `& ${pathToPSString(script)} -Source ${pathToPSString(pathtoPublish)} -Target ${pathToPSString(artifactPath)}`
                let powershell = new tr.ToolRunner('powershell.exe');
                powershell.arg('-NoLogo');
                powershell.arg('-Sta');
                powershell.arg('-NoProfile');
                powershell.arg('-NonInteractive');
                powershell.arg('-ExecutionPolicy');
                powershell.arg('Unrestricted');
                powershell.arg('-Command');
                powershell.arg(command);
                powershell.on('stdout', (buffer: Buffer) => {
                    process.stdout.write(buffer);
                });
                powershell.on('stderr', (buffer: Buffer) => {
                    process.stderr.write(buffer);
                });
                let execOptions: tr.IExecOptions = { silent: true };
                await powershell.exec(execOptions);
            }
            else {
                // file share artifacts are not currently supported on OSX/Linux.
                tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFileShareLinux'));
                return;
            }
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('PublishBuildArtifactsFailed', err.message));
    }
}

run();
