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
        let input_errorActionPreference: string = tl.getInput('errorActionPreference', false) || 'Stop';
        switch (input_errorActionPreference.toUpperCase()) {
            case 'STOP':
            case 'CONTINUE':
            case 'SILENTLYCONTINUE':
                break;
            default:
                throw new Error(tl.loc('JS_InvalidErrorActionPreference', input_errorActionPreference));
        }
        console.log("000000000000000000000000000000000000000000000 ",input_errorActionPreference);
        console.log("1111111111111111111111111111111111111111111111");

        let scriptType: string = tl.getInput('ScriptType', /*required*/true);
       let scriptPath = tl.getPathInput('ScriptPath', false);
         let scriptInline: string = tl.getInput('Inline', false);
         let scriptArguments: string = tl.getInput('ScriptArguments', false);
             let _vsts_input_errorActionPreference: string = tl.getInput('errorActionPreference', false) || 'Stop';
         let _vsts_input_failOnStandardError = tl.getBoolInput('FailOnStandardError', false);
        let targetAzurePs: string = tl.getInput('TargetAzurePs', false);
       //  let customTargetAzurePs = tl.getBoolInput('CustomTargetAzurePs', true);

        /*let input_failOnStderr = tl.getBoolInput('failOnStderr', false);
        let input_ignoreLASTEXITCODE = tl.getBoolInput('ignoreLASTEXITCODE', false);
        let input_filePath: string;
        let input_arguments: string;
        let input_script: string;*/
       
       // let input_targetType: string = tl.getInput('targetType') || '';
        if (scriptType.toUpperCase() == 'SCRIPTTYPE') {
           // scriptPath = tl.getPathInput('filePath', /*required*/ true);
            if (!tl.stats(scriptPath).isFile() || !scriptPath.toUpperCase().match(/\.PS1$/)) {
                throw new Error(tl.loc('JS_InvalidFilePath', scriptPath));
            }

            //scriptArguments = tl.getInput('arguments') || '';
        }
        else {
            scriptInline = tl.getInput('Inline', false) || '';
        }

        console.log("222222222222222222222222222222222222222222222");
        // Generate the script contents.
        console.log(tl.loc('GeneratingScript'));
        let contents: string[] = [];
      //  contents.push(`$ErrorActionPreference = '${input_errorActionPreference}'`);
        if (scriptType.toUpperCase() == 'SCRIPTTYPE') {
            contents.push(`. '${scriptPath.replace("'", "''")}' ${scriptArguments}`.trim());
            console.log(tl.loc('JS_FormattedCommand', contents[contents.length - 1]));
        }
        else {
            contents.push(scriptInline);
        }


        // Write the script to disk.
        tl.assertAgent('2.115.0');
       // let tempDirectory = tl.getVariable('agent.tempDirectory');
      //  tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
        let dirName =  path.resolve(__dirname);
        let fileName = "AzurePowerShell.ps1";
        let filePath1= dirName.concat("\\");
        let filePath = filePath1.concat(fileName);
        console.log(filePath);
        
        console.log("33333333333333333333333333333333333333333333333");
        /*await fs.writeFile(
            filePath,
            '\ufeff' + contents.join(os.EOL), // Prepend the Unicode BOM character.
            { encoding: 'utf8' });     */       // Since UTF8 encoding is specified, node will
                                            // encode the BOM into its UTF8 binary sequence.

        // Run the script.
        //
        // Note, prefer "pwsh" over "powershell". At some point we can remove support for "powershell".
        //
        // Note, use "-Command" instead of "-File" to match the Windows implementation. Refer to
        // comment on Windows implementation for an explanation why "-Command" is preferred.
        console.log("44444444444444444444444444444444444444444444444");
        let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-File')
            .arg(filePath);
        console.log("5555555555555555555555555555555555555555555555555");
        let options = <tr.IExecOptions>{
            failOnStdErr: false,
            errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
            outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
            ignoreReturnCode: true
        };

        console.log("66666666666666666666666666666666666666666666666666");

        // Listen for stderr.
        let stderrFailure = false;
        if (_vsts_input_failOnStandardError) {
            powershell.on('stderr', (data) => {
                stderrFailure = true;
            });
        }

        // Run bash.
        let exitCode: number = await powershell.exec(options);

        // Fail on exit code.
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('JS_ExitCode', exitCode));
        }

        // Fail on stderr.
        if (stderrFailure) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('JS_Stderr'));
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed');
    }
}

run();
