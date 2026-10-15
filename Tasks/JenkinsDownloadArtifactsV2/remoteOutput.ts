import os = require('os');
import util = require('util');
import tl = require('azure-pipelines-task-lib/task');

const remoteOutput: tl.ExternalOutputOptions = {
    source: 'remote',
    vsoCommandMode: tl.getPipelineFeature('SanitizeJenkinsArtifactPathsFixEnabled') ? 'blockAndTelemetry' : 'telemetryOnly'
};

export function writeRemoteOutput(message: string): void {
    tl.writeExternalOutput(message + os.EOL, remoteOutput);
}

// artifact-engine prints Jenkins file names via console.log; only its own telemetry commands may pass.
export async function withRemoteConsole<T>(action: () => Promise<T>): Promise<T> {
    const options: tl.ExternalOutputOptions = { ...remoteOutput, enableVsoCommands: true, allowedVsoCommands: ['telemetry.publish'] };
    const consoleLog = console.log;
    console.log = (...args: any[]) => tl.writeExternalOutput(util.format.apply(null, args) + os.EOL, options);
    try {
        return await action();
    } finally {
        console.log = consoleLog;
    }
}
