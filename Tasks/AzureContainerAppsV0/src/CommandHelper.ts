import tl = require("azure-pipelines-task-lib/task");
import tr = require("azure-pipelines-task-lib/toolrunner");

export class CommandHelper {

    /**
     * Re-uses logic from the translateDirectoryPath code implemented by the BashV3 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/BashV3/bash.ts#L7-L30
     * @param command - the command to execute in Bash
     * @param cwd - the current working directory; if not provided, the 'cwd' input will be used
     * @returns the string output from the command
     */
     public async execBashCommandAsync(command: string, cwd?: string): Promise<string> {
        try {
            if (!cwd) {
                cwd = tl.getPathInput("cwd", true, false);
            }

            var bashPath: string = tl.which('bash', true);
            var bashCmd = tl.tool(bashPath)
                            .arg("-c")
                            .arg(command);
            var bashOptions = <tr.IExecOptions> {
                cwd: cwd,
                failOnStdErr: true,
                errStream: process.stderr,
                outStream: process.stdout,
                ignoreReturnCode: false
            };
            var bashOutput = '';
            bashCmd.on("stdout", (data) => {
                bashOutput += data.toString();
            });
            await bashCmd.exec(bashOptions);
            return bashOutput.trim();
        } catch (err) {
            tl.error(tl.loc("BashCommandFailed", command));
            throw err;
        }
    }
}