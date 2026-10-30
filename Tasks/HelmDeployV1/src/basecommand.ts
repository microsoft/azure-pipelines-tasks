import tl = require("azure-pipelines-task-lib/task");
import tr = require('azure-pipelines-task-lib/toolrunner');
import { sanitizeLogCommands, SanitizingWritable } from "./outputSanitizer";

abstract class basecommand {
    private toolPath: string;
    private readonly externalOutputOptions: tl.ExternalOutputOptions;
    abstract getTool(): string;
    abstract login(): void;
    abstract logout(): void;

    constructor(required: boolean) {
        this.toolPath = tl.which(this.getTool(), required);
        this.externalOutputOptions = {
            source: 'childProcess',
            vsoCommandMode: tl.getPipelineFeature('EnableVsoCommandBlockingRMTasks')
                ? 'blockAndTelemetry'
                : 'telemetryOnly'
        };
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

        const { options: execOptions, sanitizers } = this.withSanitizedOutputStreams(options);
        return command.exec({ ...execOptions, externalOutput: this.externalOutputOptions }).fail(error => {
            errlines.forEach(line => tl.errorExternalOutput(this.isLogCommandSanitizationDisabled() ? line : sanitizeLogCommands(line), this.externalOutputOptions));
            throw error;
        }).fin(() => {
            if (this.isLogCommandSanitizationDisabled()) {
                return;
            }
            this.flushSanitizers(sanitizers);
        });
    }

    public execCommandSync(command: tr.ToolRunner, options?: tr.IExecOptions): tr.IExecSyncResult {
        const { options: execOptions, sanitizers } = this.withSanitizedOutputStreams(options);
        var execResult: tr.IExecSyncResult;
        try {
            execResult = command.execSync({ ...execOptions, externalOutput: this.externalOutputOptions });
        } finally {
            if (!this.isLogCommandSanitizationDisabled()) {
                this.flushSanitizers(sanitizers);
            }
        }

        if (this.isLogCommandSanitizationDisabled()) {
            return execResult;
        }

        return {
            ...execResult,
            stdout: sanitizeLogCommands(execResult.stdout),
            stderr: sanitizeLogCommands(execResult.stderr)
        };
    }

    private isLogCommandSanitizationDisabled(): boolean {
        return tl.getPipelineFeature('DisableHelmOutputLogCommandSanitization');
    }

    // ToolRunner never calls outStream.end()/errStream.end(), so any held-back
    // trailing partial line must be explicitly flushed once the command completes.
    private flushSanitizers(sanitizers: SanitizingWritable[]): void {
        sanitizers.forEach(sanitizer => sanitizer.flush());
    }

    private withSanitizedOutputStreams(options?: tr.IExecOptions): { options: tr.IExecOptions, sanitizers: SanitizingWritable[] } {
        if (this.isLogCommandSanitizationDisabled()) {
            return { options, sanitizers: [] };
        }

        var sanitizedOptions: tr.IExecOptions = Object.assign({}, options);
        var sanitizers: SanitizingWritable[] = [];
        if (!sanitizedOptions.outStream) {
            const outSanitizer = new SanitizingWritable(process.stdout);
            sanitizedOptions.outStream = outSanitizer as any;
            sanitizers.push(outSanitizer);
        }
        if (!sanitizedOptions.errStream) {
            const errSanitizer = new SanitizingWritable(process.stderr);
            sanitizedOptions.errStream = errSanitizer as any;
            sanitizers.push(errSanitizer);
        }
        return { options: sanitizedOptions, sanitizers };
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