import os = require('os');
import util = require('util');
import tl = require('azure-pipelines-task-lib/task');

export const vsoCommandMode: tl.ExternalOutputOptions['vsoCommandMode'] =
    tl.getPipelineFeature('SanitizeJenkinsArtifactPathsFixEnabled') ? 'blockAndTelemetry' : 'telemetryOnly';

const remoteOutput: tl.ExternalOutputOptions = { source: 'remote', vsoCommandMode };

// artifact-engine prints Jenkins file names via console.log; only its own telemetry commands may pass.
const engineOutput: tl.ExternalOutputOptions = { ...remoteOutput, enableVsoCommands: true, allowedVsoCommands: ['telemetry.publish'] };

export function writeRemoteOutput(message: string): void {
    tl.writeExternalOutput(message + os.EOL, remoteOutput);
}

export async function withRemoteConsole<T>(action: () => Promise<T>): Promise<T> {
    const consoleLog = console.log;
    console.log = (...args: any[]) => tl.writeExternalOutput(util.format(...args) + os.EOL, engineOutput);
    try {
        return await action();
    } finally {
        console.log = consoleLog;
    }
}