import * as fs from 'fs';
import * as path from 'path';

import * as task from 'vsts-task-lib/task';
import * as toolRunner from 'vsts-task-lib/toolrunner';

import * as uuidV4 from 'uuid/v4';

interface TaskParameters {
    targetType: string,
    filePath?: string,
    script?: string,
    arguments?: string,
    pythonInterpreter?: string,
    workingDirectory?: string,
    failOnStderr?: boolean
}

export async function pythonScript(parameters: Readonly<TaskParameters>): Promise<void> {
    // Get the script to run
    const scriptPath = await (async () => {
        if (parameters.targetType.toLowerCase() === 'filepath') { // Run script file
            // Required if `targetType` is 'filepath':
            const filePath = parameters.filePath!;

            if (!fs.statSync(filePath).isFile()) {
                throw new Error(task.loc('NotAFile', filePath));
            }
            return filePath;
        } else { // Run inline script
            // Required if `targetType` is 'script':
            const script = parameters.script!;

            // Write the script to disk
            task.assertAgent('2.115.0');
            const tempDirectory = task.getVariable('agent.tempDirectory');
            task.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
            const filePath = path.join(tempDirectory, `${uuidV4()}.py`);
            await fs.writeFileSync(
                filePath,
                script,
                { encoding: 'utf8' });

            return filePath;
        }
    })();

    // Create the tool runner
    const pythonPath = parameters.pythonInterpreter || task.which('python');
    const python = task.tool(pythonPath).arg(scriptPath);

    // Calling `line` with a falsy argument returns `undefined`, so can't chain this call
    if (parameters.arguments) {
        python.line(parameters.arguments);
    }

    // Run the script
    // Use `any` to work around what I suspect are bugs with `IExecOptions`'s type annotations:
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