import os = require('os');
import util = require('util');
import tl = require('azure-pipelines-task-lib/task');

// ##vso markers are blocked when the pipeline feature is enabled; otherwise they are only reported through task-lib telemetry.
export class ExternalOutput {
    public readonly options: tl.ExternalOutputOptions;

    constructor(source: tl.ExternalOutputOptions['source'], pipelineFeature: string) {
        this.options = { source, vsoCommandMode: tl.getPipelineFeature(pipelineFeature) ? 'blockAndTelemetry' : 'telemetryOnly' };
    }

    public writeLine(message: string): void {
        tl.writeExternalOutput(message + os.EOL, this.options);
    }

    // Treats console.log as this output while the action runs; allowedVsoCommands (e.g. a library's own telemetry) still pass.
    public async withConsole<T>(action: () => Promise<T>, allowedVsoCommands: string[] = []): Promise<T> {
        const options: tl.ExternalOutputOptions = { ...this.options, enableVsoCommands: true, allowedVsoCommands };
        const consoleLog = console.log;
        console.log = (...args: any[]) => tl.writeExternalOutput(util.format(...args) + os.EOL, options);
        try {
            return await action();
        } finally {
            console.log = consoleLog;
        }
    }
}
