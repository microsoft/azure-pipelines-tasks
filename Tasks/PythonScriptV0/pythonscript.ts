import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';

// import * as uuidV4 from 'uuid/v4';

import { Platform } from './taskutil';

interface TaskParameters {
    // versionSpec: string,
    // addToPath: boolean,
    // architecture: string
}

export async function pythonScript(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    // // Generate the script contents.
    // console.log(tl.loc('GeneratingScript'));
    // let bashPath: string = tl.which('bash', true);
    // let contents: string;
    // if (input_targetType.toUpperCase() == 'FILEPATH') {
    //     // Translate the target file path from Windows to the Linux file system.
    //     let targetFilePath: string;
    //     if (process.platform == 'win32') {
    //         targetFilePath = await translateDirectoryPath(bashPath, path.dirname(input_filePath)) + '/' + path.basename(input_filePath);
    //     }
    //     else {
    //         targetFilePath = input_filePath;
    //     }

    //     contents = `. '${targetFilePath.replace("'", "'\\''")}' ${input_arguments}`.trim();
    //     console.log(tl.loc('JS_FormattedCommand', contents));
    // }
    // else {
    //     contents = input_script;

    //     // Print one-liner scripts.
    //     if (contents.indexOf('\n') < 0 && contents.toUpperCase().indexOf('##VSO[') < 0) {
    //         console.log(tl.loc('JS_ScriptContents'));
    //         console.log(contents);
    //     }
    // }

    // // Write the script to disk.
    // tl.assertAgent('2.115.0');
    // let tempDirectory = tl.getVariable('agent.tempDirectory');
    // tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
    // let fileName = uuidV4() + '.sh';
    // let filePath = path.join(tempDirectory, fileName);
    // await fs.writeFileSync(
    //     filePath,
    //     contents,
    //     { encoding: 'utf8' });

    // // Translate the script file path from Windows to the Linux file system.
    // if (process.platform == 'win32') {
    //     filePath = await translateDirectoryPath(bashPath, tempDirectory) + '/' + fileName;
    // }

    // // Create the tool runner.
    // let bash = tl.tool(bashPath)
    //     .arg('--noprofile')
    //     .arg('--norc')
    //     .arg(filePath);
    // let options = <tr.IExecOptions>{
    //     cwd: input_workingDirectory,
    //     failOnStdErr: false,
    //     errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
    //     outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
    //     ignoreReturnCode: true
    // };

    // // Listen for stderr.
    // let stderrFailure = false;
    // if (input_failOnStderr) {
    //     bash.on('stderr', (data) => {
    //         stderrFailure = true;
    //     });
    // }

    // // Run bash.
    // let exitCode: number = await bash.exec(options);

    // // Fail on exit code.
    // if (exitCode !== 0) {
    //     tl.setResult(tl.TaskResult.Failed, tl.loc('JS_ExitCode', exitCode));
    // }

    // // Fail on stderr.
    // if (stderrFailure) {
    //     tl.setResult(tl.TaskResult.Failed, tl.loc('JS_Stderr'));
    // }
}