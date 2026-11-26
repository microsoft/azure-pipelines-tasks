import assert = require('assert');
import tl = require('azure-pipelines-task-lib/task');
import { Logger } from 'artifact-engine/Engine/logger';

export interface CapturedOutput {
    ordinary: string[];
    debug: string[];
    detection: { source: string; commandName: string; blocked: boolean }[];
    performance: string[];
    debugEnabled: boolean;
}

export async function loadArtifactEngine() {
    const unhandled = new Set(process.listeners('unhandledRejection'));
    const uncaught = new Set(process.listeners('uncaughtException'));
    const { ArtifactEngine } = await import('artifact-engine/Engine');
    const addedUnhandled = process.listeners('unhandledRejection').filter(listener => !unhandled.has(listener));
    const addedUncaught = process.listeners('uncaughtException').filter(listener => !uncaught.has(listener));
    return {
        ArtifactEngine,
        restoreHandlers: () => {
            addedUnhandled.forEach(listener => process.removeListener('unhandledRejection', listener));
            addedUncaught.forEach(listener => process.removeListener('uncaughtException', listener));
        }
    };
}

export async function captureEngineOutput(gate: boolean, action: () => Promise<void>): Promise<CapturedOutput> {
    const feature = 'DISTRIBUTEDTASK_TASKS_ENABLEARTIFACTENGINEEXTERNALOUTPUT';
    const previousFeature = process.env[feature];
    const previousAgent = process.env['AGENT_VERSION'];
    const previousMode = Logger.vsoCommandMode;
    const previousVerbose = Logger.verbose;
    const previousWrite = process.stdout.write;
    let output = '';
    process.env[feature] = String(gate);
    process.env['AGENT_VERSION'] = '4.0.0';
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
        output += chunk.toString();
        return true;
    };
    try {
        // Probe the cached task-lib debug setting; runtime SYSTEM_DEBUG changes cannot change it.
        tl.debug('jenkins-debug-probe');
        const debugEnabled = output.indexOf('jenkins-debug-probe') !== -1;
        output = '';
        await action();
        const lines = output.split(/\r?\n/);
        const detection = lines.filter(line => line.indexOf('##vso[telemetry.publish ') === 0 &&
            line.indexOf('feature=ExternalOutputVsoCommand') !== -1);
        return {
            ordinary: lines.filter(line => line.indexOf('##vso[') !== 0),
            debug: lines.filter(line => line.indexOf('##vso[task.debug]') === 0),
            detection: detection.map(line => JSON.parse(line.substring(line.indexOf(']') + 1))),
            performance: lines.filter(line => line.indexOf('##vso[telemetry.publish ') === 0 &&
                line.indexOf('feature=performance') !== -1),
            debugEnabled
        };
    } finally {
        process.stdout.write = previousWrite;
        Logger.vsoCommandMode = previousMode;
        Logger.verbose = previousVerbose;
        if (previousFeature === undefined) {
            delete process.env[feature];
        } else {
            process.env[feature] = previousFeature;
        }
        if (previousAgent === undefined) {
            delete process.env['AGENT_VERSION'];
        } else {
            process.env['AGENT_VERSION'] = previousAgent;
        }
    }
}

export function assertDetection(output: CapturedOutput, gate: boolean, blocked: boolean): void {
    if (!gate) {
        assert.strictEqual(output.detection.length, 0);
        return;
    }
    assert(output.detection.length > 0, 'remote command detection telemetry should be emitted');
    output.detection.forEach(event => {
        assert.strictEqual(event.source, 'remote');
        assert.strictEqual(event.commandName, 'task.debug');
        assert.strictEqual(event.blocked, blocked);
    });
}
