import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';

export function validateScriptArgs(inputArguments: string, targetShellType: string): void {
    const featureFlags = {
        audit: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC_LOG'),
        activate: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC'),
        telemetry: tl.getBoolFeatureFlag('AZP_75787_ENABLE_COLLECT')
    };

    if (!(featureFlags.activate || featureFlags.audit || featureFlags.telemetry)) {
        return;
    }

    if (!inputArguments) {
        return;
    }

    const normalizedShellType = (targetShellType || 'bash').toLowerCase();
    const isPowerShell = normalizedShellType === 'powershell';
    const isCmd = normalizedShellType === 'cmd';

    let sanitizedArgs: string;
    let telemetry: { removedSymbols?: Record<string, number>; removedSymbolsCount?: number } | null;

    if (isPowerShell) {
        [sanitizedArgs, telemetry] = sanitizeArgs(inputArguments, {
            argsSplitSymbols: '``',
            saniziteRegExp: new RegExp("(?<!`)([^a-zA-Z0-9`\\\\ _'\"\\-=\\/:\\.])", 'g')
        });
    } else if (isCmd) {
        const cmdRegExp = new RegExp(`(?<!\\^)([^a-zA-Z0-9\\^\\\\ _'"\\-=\\/:.])`, 'g');
        const argsChunks = inputArguments.split('^^');
        const matchesChunks: string[][] = [];
        for (let i = 0; i < argsChunks.length; i++) {
            const chunkMatches = argsChunks[i].match(cmdRegExp);
            if (chunkMatches) {
                matchesChunks.push(chunkMatches);
            }
            argsChunks[i] = argsChunks[i].replace(cmdRegExp, '_#removed#_');
        }
        sanitizedArgs = argsChunks.join('^^');
        const allMatches = ([] as string[]).concat(...matchesChunks);
        telemetry = allMatches.length
            ? { removedSymbols: allMatches.reduce((acc, c) => ({ ...acc, [c]: (acc[c] || 0) + 1 }), {} as Record<string, number>), removedSymbolsCount: allMatches.length }
            : null;
    } else {
        [sanitizedArgs, telemetry] = sanitizeArgs(inputArguments, {
            argsSplitSymbols: '\\\\',
            saniziteRegExp: new RegExp(`(?<!\\\\)([^a-zA-Z0-9\\\\ _'"\\-=\\/:.])`, 'g')
        });
    }

    if (sanitizedArgs === inputArguments) {
        return;
    }

    if (featureFlags.telemetry && telemetry) {
        try {
            emitTelemetry('TaskHub', 'SshV0', { ...telemetry, targetShellType: normalizedShellType });
        } catch (e) {
            tl.debug(`Failed to emit script-args sanitizer telemetry: ${e}`);
        }
    }

    const messageKey = isPowerShell ? 'ScriptArgsSanitizedPowerShell' : isCmd ? 'ScriptArgsSanitizedCmd' : 'ScriptArgsSanitized';
    const message = tl.loc(messageKey);
    if (featureFlags.activate) {
        throw new Error(message);
    }
    if (featureFlags.audit) {
        tl.warning(message);
    }
}

