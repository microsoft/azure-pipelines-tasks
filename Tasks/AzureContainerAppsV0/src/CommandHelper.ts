import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

export class CommandHelper {

    /**
     * Runs a command based on the OS of the agent running this task.
     * @param command - the command to execute
     * @param cwd - the current working directory; if not provided, the 'cwd' input will be used
     * @returns the string output from the command
     */
    public async execCommandAsync(command: string, cwd?: string) : Promise<string> {
        return os.platform() == 'win32' ?
            this.execPwshCommandAsync(command, cwd) :
            this.execBashCommandAsync(command, cwd);
    }

    /**
     * Re-uses logic from the translateDirectoryPath code implemented by the BashV3 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/BashV3/bash.ts#L7-L30
     * @param command - the command to execute in Bash
     * @param cwd - the current working directory; if not provided, the 'cwd' input will be used
     * @returns the string output from the command
     */
     private async execBashCommandAsync(command: string, cwd?: string): Promise<string> {
        try {
            if (!cwd) {
                cwd = tl.getPathInput('cwd', true, false);
            }

            const bashPath: string = tl.which('bash', true);
            const bashCmd = tl.tool(bashPath)
                            .arg('-c')
                            .arg(command);
            const bashOptions = <tr.IExecOptions> {
                cwd: cwd,
                failOnStdErr: true,
                errStream: process.stderr,
                outStream: process.stdout,
                ignoreReturnCode: false
            };
            let bashOutput = '';
            bashCmd.on('stdout', (data) => {
                bashOutput += data.toString();
            });
            await bashCmd.exec(bashOptions);
            return bashOutput.trim();
        } catch (err) {
            tl.error(tl.loc('BashCommandFailed', command));
            throw err;
        }
    }

    /**
     * Executes a given command using the pwsh executable.
     * @param command - the command to execute in PowerShell
     * @param cwd - the current working directory; if not provided, the 'cwd' input will be used
     * @returns the string output from the command
     */
    private async execPwshCommandAsync(command: string, cwd?: string): Promise<string> {
        try {
            if (!cwd) {
                cwd = tl.getPathInput('cwd', true, false);
            }

            const pwshPath: string = tl.which('pwsh.exe', true);
            const pwshCmd = tl.tool(pwshPath)
                            .arg('-command')
                            .arg(command);
            const pwshOptions = <tr.IExecOptions> {
                cwd: cwd,
                failOnStdErr: true,
                errStream: process.stderr,
                outStream: process.stdout,
                ignoreReturnCode: false
            };
            let pwshOutput = '';
            pwshCmd.on('stdout', (data) => {
                pwshOutput += data.toString();
            });
            await pwshCmd.exec(pwshOptions);
            return pwshOutput.trim();
        } catch (err) {
            tl.error(tl.loc('PwshCommandFailed', command));
            throw err;
        }
    }
}