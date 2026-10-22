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
        var command = tl.tool(this.toolPath);
        return command;
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions) {
        var errlines = [];
        command.on("stderr", line => {
            errlines.push(line);
        });

        command.on("error", line => {
            errlines.push(line);
        });

        return command.exec({ ...options, externalOutput: this.getExternalOutputOptions() }).fail(error => {
            errlines.forEach(line => tl.errorExternalOutput(line, this.getExternalOutputOptions()));
            throw error;
        });
    }

    public execCommandSync(command: tr.ToolRunner, options?: tr.IExecOptions): tr.IExecSyncResult {
        return command.execSync({ ...options, externalOutput: this.getExternalOutputOptions() });
    }

    private getExternalOutputOptions(): tl.ExternalOutputOptions {
        return {
            source: 'childProcess',
            vsoCommandMode: tl.getPipelineFeature('EnableVsoCommandBlockingRMTasks')
                ? 'blockAndTelemetry'
                : 'telemetryOnly'
        };
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