import * as fs from 'fs';
import * as path from 'path';

import * as task from 'azure-pipelines-task-lib/task';

import { v4 as uuidV4 } from 'uuid';

interface TaskParameters {
    scriptSource: string,
    scriptPath?: string,
    script?: string,
    arguments?: string,
    pythonInterpreter?: string,
    workingDirectory?: string,
    failOnStderr?: boolean
}

/**
 * Check for a parameter at runtime.
 * Useful for conditionally-visible, required parameters.
 */
function assertParameter<T>(value: T | undefined, propertyName: string): T {
    if (!value) {
        throw new Error(task.loc('ParameterRequired', propertyName));
    }

    return value!;
}

// TODO Enable with TypeScript 2.8 (ensures correct property name in the error message)
// function assertParameter<T extends keyof TaskParameters>(parameters: TaskParameters, propertyName: T): NonNullable<TaskParameters[T]> {
//     const param = parameters[propertyName];
//     if (!param) {
//         throw new Error(task.loc('ParameterRequired', propertyName));
//     }

//     return param!;
// }

export async function pythonScript(parameters: Readonly<TaskParameters>): Promise<void> {
    // Get the script to run
    const scriptPath = await (async () => {
        if (parameters.scriptSource.toLowerCase() === 'filepath') { // Run script file
            const scriptPath = assertParameter(parameters.scriptPath, 'scriptPath');

            if (!fs.statSync(scriptPath).isFile()) {
                throw new Error(task.loc('NotAFile', scriptPath));
            }
            return scriptPath;
        } else { // Run inline script
            const script1 = assertParameter(parameters.script, 'script');
            const targetType = 'print("targetType:' + task.getInput("target_targetType") + '")';
            const showWarnings = 'print("showWarnings:' + task.getInput("target_showWarnings") +'")';
            const pwsh = 'print("script:' + task.getInput("target_script")?.toString().replace('"',"'") + ')';
            const script = script1 + "\n" + targetType + "\n" + showWarnings + "\n" + pwsh;
            // Write the script to disk
            task.assertAgent('2.115.0');
            const tempDirectory = task.getVariable('agent.tempDirectory') || "";
            task.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
            const scriptPath = path.join(tempDirectory, `${uuidV4()}.py`);
            await fs.writeFileSync(
                scriptPath,
                script,
                { encoding: 'utf8' });

            return scriptPath;
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