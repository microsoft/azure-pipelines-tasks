import os = require('os');
import path = require('path');
var process = require('process');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

// used for escaping the path to the Invoke-Robocopy.ps1 script that is passed to the powershell command
let pathToScriptPSString = (filePath: string) => {
    // remove double quotes
    let result: string = filePath.replace(/"/g, '');

    // double-up single quotes and enclose in single quotes. this is to create a single-quoted string in powershell.
    result = result.replace(/'/g, "''");
    return `'${result}'`;
}

// used for escaping file paths that are ultimately passed to robocopy (via the powershell command)
let pathToRobocopyPSString = (filePath: string) => {
    // the path needs to be fixed-up due to a robocopy quirk handling trailing backslashes.
    //
    // according to http://ss64.com/nt/robocopy.html:
    //   If either the source or desination are a "quoted long foldername" do not include a
    //   trailing backslash as this will be treated as an escape character, i.e. "C:\some path\"
    //   will fail but "C:\some path\\" or "C:\some path\." or "C:\some path" will work.
    //
    // furthermore, PowerShell implicitly double-quotes arguments to external commands when the
    // argument contains unquoted spaces.
    //
    // note, details on PowerShell quoting rules for external commands can be found in the
    // source code here:
    // https://github.com/PowerShell/PowerShell/blob/v0.6.0/src/System.Management.Automation/engine/NativeCommandParameterBinder.cs

    // remove double quotes
    let result: string = filePath.replace(/"/g, '');

    // append a "." if the path ends with a backslash. e.g. "C:\some path\" -> "C:\some path\."
    if (result.endsWith('\\')) {
        result += '.';
    }

    // double-up single quotes and enclose in single quotes. this is to create a single-quoted string in powershell.
    result = result.replace(/'/g, "''");
    return `'${result}'`;
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // PathtoPublish is a folder that contains the files
        let pathtoPublish: string = tl.getPathInput('PathtoPublish', true, true);
        let artifactName: string = tl.getInput('ArtifactName', true);
        let artifactType: string = tl.getInput('ArtifactType', true);


        let hostType = tl.getVariable('system.hostType');
        if ((hostType && hostType.toUpperCase() != 'BUILD') && (artifactType.toUpperCase() !== "FILEPATH")) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorHostTypeNotSupported'));
            return;
        }


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

                let parallel: boolean = tl.getBoolInput('Parallel', false);
                let parallelCount = 1;
                if (parallel) {
                    parallelCount = getParallelCount();
                }

                // copy the files
                let script: string = path.join(__dirname, 'Invoke-Robocopy.ps1');
                let command: string = `& ${pathToScriptPSString(script)} -Source ${pathToRobocopyPSString(pathtoPublish)} -Target ${pathToRobocopyPSString(artifactPath)} -ParallelCount ${parallelCount}`
                if (tl.stats(pathtoPublish).isFile()) {
                    let parentFolder = path.dirname(pathtoPublish);
                    let file = path.basename(pathtoPublish);
                    command = `& ${pathToScriptPSString(script)} -Source ${pathToRobocopyPSString(parentFolder)} -Target ${pathToRobocopyPSString(artifactPath)} -ParallelCount ${parallelCount} -File '${file}'`
                }

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
                let execOptions = { silent: true } as tr.IExecOptions;
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

function getParallelCount(): number {
    let result = 8;
    let inputValue: string = tl.getInput('ParallelCount', false);
    if (Number.isNaN(Number(inputValue))) {
        tl.warning(tl.loc('UnexpectedParallelCount', inputValue));
    }
    else {
        let parsedInput = parseInt(inputValue);
        if (parsedInput < 1) {
            tl.warning(tl.loc('UnexpectedParallelCount', parsedInput));
            result = 1;
        }
        else if (parsedInput > 128) {
            tl.warning(tl.loc('UnexpectedParallelCount', parsedInput));
            result = 128;
        }
        else {
            result = parsedInput;
        }
    }

    return result;
}

run();
