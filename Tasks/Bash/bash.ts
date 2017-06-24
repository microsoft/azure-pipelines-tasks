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
        let failOnStderr = tl.getBoolInput('failOnStderr', false);
        let script: string = tl.getInput('script', false) || '';
        let workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);

        // Write the script to disk.
        tl.assertAgent('2.115.0');
        let tempDirectory = tl.getVariable('agent.tempDirectory');
        tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
        let fileName = uuidV4() + '.sh';
        let filePath = path.join(tempDirectory, fileName);
        await fs.writeFileSync(
            filePath,
            script,
            { encoding: 'utf8' });

        let bashPath: string = tl.which('bash', true);
        if (process.platform == 'win32') {
            // Translate the script path from Windows to the Linux file system.
            let bashPwd = tl.tool(bashPath)
                .arg('--noprofile')
                .arg('--norc')
                .arg('-c')
                .arg('pwd');
            let bashPwdOptions = <tr.IExecOptions>{
                cwd: tempDirectory,
                failOnStdErr: true,
                errStream: process.stdout,
                outStream: process.stdout,
                ignoreReturnCode: false
            };
            let pwdOutput = '';
            bashPwd.on('stdout', (data) => {
                pwdOutput += data.toString().trim();
            });
            await bashPwd.exec(bashPwdOptions);
            if (!pwdOutput) {
                throw new Error(tl.loc('JS_TranslatePathFailed', tempDirectory));
            }

            filePath = `${pwdOutput}/${fileName}`;
        }

        // Create the tool runner.
        let bash = tl.tool(bashPath)
            .arg('--noprofile')
            .arg('--norc')
            .arg(filePath);
        let options = <tr.IExecOptions>{
            cwd: workingDirectory,
            failOnStdErr: false,
            errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
            outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
            ignoreReturnCode: true
        };

        // Listen for stderr.
        let stderrFailure = false;
        if (failOnStderr) {
            bash.on('stderr', (data) => {
                stderrFailure = true;
            });
        }

        // Run bash.
        let exitCode: number = await bash.exec(options);

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
