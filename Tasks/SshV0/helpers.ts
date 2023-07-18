import * as tl from 'azure-pipelines-task-lib';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';

/**
 * This function sanitizes input arguments. We're sanitizing each symbol which we think is dangerous.
 * @param args original input arguments param
 * @returns sanitized input arguments
 */
export function sanitizeScriptArgs(args: string): string {
    const removedSymbolSign = '_#removed#_';
    const argsSplitSymbols = '\\\\';

    const featureFlags = {
        audit: tl.getBoolFeatureFlag('AZP_MSRC75787_ENABLE_NEW_LOGIC_AUDIT'),
        activate: tl.getBoolFeatureFlag('AZP_MSRC75787_ENABLE_NEW_LOGIC'),
        telemetry: tl.getBoolFeatureFlag('AZP_MSRC75787_ENABLE_TELEMETRY')
    };

    // We're splitting by esc. symbol pairs, removing all suspicious characters and then join back
    const argsArr = args.split(argsSplitSymbols);
    for (let i = 0; i < argsArr.length; i++) {
        // '?<!`' - checks if before a character is no escaping symbol. '^a-zA-Z0-9` _'"-' - checking if character is allowed. Instead replaces to _#removed#_
        argsArr[i] = argsArr[i].replace(/(?<!\\)([^a-zA-Z0-9\\ _'"\-])/g, removedSymbolSign);
    }

    const resultArgs = argsArr.join(argsSplitSymbols);

    if (resultArgs.includes(removedSymbolSign)) {
        if (featureFlags.audit || featureFlags.activate) {
            tl.warning(tl.loc('FileArgsSanitized', resultArgs));
        }

        if (featureFlags.telemetry) {
            const removedSymbolsCount = (resultArgs.match(removedSymbolSign) || []).length;
            emitTelemetry('TaskHub', 'BashV3', { removedSymbolsCount })
        }
    }

    return resultArgs;
}
