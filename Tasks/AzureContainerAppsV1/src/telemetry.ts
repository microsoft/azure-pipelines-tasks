import * as tl from 'azure-pipelines-task-lib/task';

const TELEMETRY_AREA: string = 'TaskHub';
const TELEMETRY_FEATURE: string = 'AzureContainerAppsV1';

const SHELL_METACHAR_REGEX: RegExp = /[;|&$`(){}<>*?!\\]/;
const WHITESPACE_REGEX: RegExp = /\s/;

export interface ArgInjectionTelemetry {
    event: string;
    input: string;
    hasWhitespace: number;
    hasShellMetachar: number;
    length: number;
    wouldSplitIntoArgs: number;
}

export function emitTelemetry(telemetryData: ArgInjectionTelemetry): void {
    try {
        console.log(`##vso[telemetry.publish area=${TELEMETRY_AREA};feature=${TELEMETRY_FEATURE}]${JSON.stringify(telemetryData)}`);
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}

// Emits metadata (never the raw value) about a user-controlled input to assess arg-injection risk.
export function emitArgInjectionRiskTelemetry(inputName: string, value: string): void {
    try {
        if (value === undefined || value === null || value.length === 0) {
            return;
        }

        const trimmed: string = value.trim();
        // Split on whitespace runs to count how many arguments this value would become when passed as a string; >1 signals possible arg injection
        const wouldSplitIntoArgs: number = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;

        emitTelemetry({
            event: 'ArgInjectionRiskDetected',
            input: inputName,
            hasWhitespace: WHITESPACE_REGEX.test(value) ? 1 : 0,
            hasShellMetachar: SHELL_METACHAR_REGEX.test(value) ? 1 : 0,
            length: value.length,
            wouldSplitIntoArgs: wouldSplitIntoArgs
        });
    } catch (err) {
        tl.debug(`Unable to compute or log arg-injection risk telemetry. Err:( ${err} )`);
    }
}
