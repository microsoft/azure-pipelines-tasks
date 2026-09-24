import tl = require("azure-pipelines-task-lib/task");
import tr = require('azure-pipelines-task-lib/toolrunner');

abstract class basecommand {
    private toolPath: string;
    abstract getTool(): string;
    abstract login(): void;
    abstract logout(): void;

    constructor(required: boolean) {
        this.toolPath = tl.which(this.getTool(), required);
    }

    public getToolPath(): string {
        return this.toolPath;
    }

    public createCommand(): tr.ToolRunner {
        const command = tl.tool(this.toolPath);
        return command;
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions) {
        const errlines: string[] = [];

        command.on("stderr", line => {
            errlines.push(line);
        });

        command.on("error", line => {
            errlines.push(line);
        });

        const execOptions = Object.assign({}, options, {
            externalOutput: { source: 'childProcess' }
        });

        return command.exec(execOptions).fail(error => {
            errlines.forEach(line => tl.error(line));
            throw error;
        });
    }

    public execCommandSync(command: tr.ToolRunner, options?: tr.IExecOptions): tr.IExecSyncResult {
        const execOptions = Object.assign({}, options, {
            externalOutput: { source: 'childProcess' }
        });

        return command.execSync(execOptions);
    }

    public IsInstalled(): boolean {
        return !!this.getToolPath();
    }

    public static handleExecResult(execResult: tr.IExecSyncResult) {
        if (execResult.code != tl.TaskResult.Succeeded) {

            tl.debug('execResult: ' + JSON.stringify(execResult));
            if (!!execResult.error || !!execResult.stderr) {
                tl.setResult(tl.TaskResult.Failed, execResult.stderr);
            }
            else {
                tl.setResult(tl.TaskResult.Failed, "");
            }
        }
    }
}

export default basecommand;