import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import * as task from 'vsts-task-lib/task';
import * as toolRunner from 'vsts-task-lib/toolrunner';

import * as uuidV4 from 'uuid/v4';

interface TaskParameters {
    targetType: string,
    filePath: string,
    arguments: string,
    script: string,
    // pythonInterpreter: string,
    workingDirectory: string,
    failOnStderr: boolean
}

export async function pythonScript(parameters: Readonly<TaskParameters>): Promise<void> {
    // Get the script to run
    const scriptPath = await (async () => {
        if (parameters.targetType.toUpperCase() === 'FILEPATH') { // Run script file
            if (!fs.statSync(parameters.filePath).isFile()) {
                throw new Error(task.loc('NotAFile', parameters.filePath));
            }
            return parameters.filePath;
        } else { // Run inline script
            // Print one-line scripts
            if (parameters.script.indexOf('\n') < 0 && parameters.script.toUpperCase().indexOf('##VSO[') < 0) {
                console.log(parameters.script);
            }

            // Write the script to disk
            task.assertAgent('2.115.0');
            const tempDirectory = task.getVariable('agent.tempDirectory');
            task.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
            const filePath = path.join(tempDirectory, `${uuidV4()}.py`);
            await fs.writeFileSync(
                filePath,
                parameters.script,
                { encoding: 'utf8' });

            return filePath;
        }
    })();

    // Create the tool runner
    // const pythonPath = parameters.pythonInterpreter || task.which('python');
    const pythonPath = task.which('python');
    const python = task.tool(pythonPath).arg(scriptPath);

    // Run the script
    // TODO use `any` to work around what I suspect are bugs with `IExecOptions`'s type annotations:
    // - optional fields need to be typed as optional
    // - `errStream` and `outStream` should be `NodeJs.WritableStream`, not `NodeJS.Writable`
    await python.exec(<any>{
        cwd: parameters.workingDirectory,
        failOnStdErr: parameters.failOnStderr,
        // Direct all output to stdout, otherwise the output may appear out-of-order since Node buffers its own stdout but not stderr
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: false
    });
}