import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
var uuidV4 = require('uuid/v4');

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get inputs.
        let errorActionPreference: string = tl.getInput('errorActionPreference', false) || 'Stop';
        switch (errorActionPreference.toUpperCase()) {
            case 'STOP':
            case 'CONTINUE':
            case 'SILENTLYCONTINUE':
                break;
            default:
                throw new Error(tl.loc('JS_InvalidErrorActionPreference', errorActionPreference));
        }
        let executionPolicy: string = tl.getInput('executionPolicy', false) || 'Unrestricted';
        let failOnStderr = tl.getBoolInput('failOnStderr', false);
        let ignoreExitCode = tl.getBoolInput('ignoreExitCode', false);
        let ignoreLASTEXITCODE = tl.getBoolInput('ignoreLASTEXITCODE', false);
        let script: string = tl.getInput('script', false) || '';
        let workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);

        // Generate the script contents.
        let contents: string[] = [];
        contents.push(`$ErrorActionPreference = '${errorActionPreference}'`);
        contents.push(script);
        if (!ignoreLASTEXITCODE) {
            contents.push(`if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {`);
            contents.push(`    Write-Verbose 'Last exit code is not set.'`);
            contents.push(`} else {`);
            contents.push(`    Write-Verbose ('$LASTEXITCODE: {0}' -f $LASTEXITCODE)`);
            contents.push(`    exit $LASTEXITCODE`);
            contents.push(`}`);
        }

        // Write the script to disk.
        tl.assertAgent('2.115.0');
        let tempDirectory = tl.getVariable('agent.tempDirectory');
        tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
        let filePath = path.join(tempDirectory, uuidV4() + '.ps1');
        await fs.writeFile(
            filePath,
            '\ufeff' + contents.join(os.EOL), // Prepend the Unicode BOM character.
            { encoding: 'utf8' });            // Since UTF8 encoding is specified, node will
        //                                    // encode the BOM into its UTF8 binary sequence.

        // Run the script.
        let powershell = tl.tool(tl.which('powershell', true))
            .arg('-NoLogo')
            .arg(`-Sta`)
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg(executionPolicy)
            .arg('-File')
            .arg(filePath);
        let options = <tr.IExecOptions>{
            cwd: workingDirectory,
            failOnStdErr: failOnStderr,
            ignoreReturnCode: ignoreExitCode
        };
        await powershell.exec(options);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed');
    }
}

run();
