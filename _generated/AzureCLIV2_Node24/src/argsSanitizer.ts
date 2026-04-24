// Reuses the work-item-75787 argument sanitizer used by BashV3 and the
// PowerShell ArgumentsSanitizer. Three feature flags drive behavior:
//   AZP_75787_ENABLE_NEW_LOGIC      -> throw on disallowed characters
//   AZP_75787_ENABLE_NEW_LOGIC_LOG  -> warn on disallowed characters (audit)
//   AZP_75787_ENABLE_COLLECT        -> emit telemetry only
// When scriptType === 'bash' the args line is first expanded ($VAR / ${VAR})
// so a value-injected secret like VAR=";rm -rf /" is also caught. For other
// script types (pscore, ps, batch) we sanitize the literal scriptArguments.

import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
import { IssueSource } from 'azure-pipelines-task-lib/internal';

export class ArgsSanitizingError extends Error {
    constructor(message: string) {
        super(message);
    }
}

// Outer gate (`EnableAzureCliArgsValidation`, default OFF) decides whether the
// sanitizer runs at all. ArgsSanitizingError signals an intentional block and
// is rethrown; any other unexpected exception is reported as
// `ArgsValidationFailure` telemetry and swallowed so a sanitizer bug never
// breaks an otherwise valid pipeline run.
export function tryValidateScriptArgs(
    inputArguments: string,
    scriptType: string,
    validator: (args: string, type: string) => void = validateScriptArgs
): void {
    if (!tl.getPipelineFeature('EnableAzureCliArgsValidation')) {
        return;
    }
    try {
        validator(inputArguments, scriptType);
    } catch (err) {
        const e = err as { name?: string; message?: string };
        tl.debug(`validateScriptArgs threw an unexpected error: ${e?.message ?? err}`);
        try {
            emitTelemetry('TaskHub', 'AzureCLIV2', {
                event: 'ArgsValidationFailure',
                errorName: e?.name ?? 'Unknown',
                errorMessage: e?.message ?? String(err)
            });
        } catch (telemetryErr) {
            tl.debug(`Failed to emit ArgsValidationFailure telemetry: ${telemetryErr}`);
        }
    }
}

type BashEnvTelemetry = {
    foundPrefixes: number,
    quottedBlocks: number,
    variablesExpanded: number,
    escapedVariables: number,
    escapedEscapingSymbols: number,
    braceSyntaxEntries: number,
    bracedVariables: number,
    variablesWithESInside: number,
    unmatchedQuotes: number,
    notClosedBraceSyntaxPosition: number,
    indirectExpansionTries: number,
    invalidEnvName: number,
    notExistingEnv: number
};

export function expandBashEnvVariables(argsLine: string): [string, BashEnvTelemetry] {
    const envPrefix = '$';
    const quote = '\'';
    const escapingSymbol = '\\';

    let result = argsLine;
    let startIndex = 0;
    const telemetry: BashEnvTelemetry = {
        foundPrefixes: 0,
        quottedBlocks: 0,
        variablesExpanded: 0,
        escapedVariables: 0,
        escapedEscapingSymbols: 0,
        braceSyntaxEntries: 0,
        bracedVariables: 0,
        variablesWithESInside: 0,
        unmatchedQuotes: 0,
        notClosedBraceSyntaxPosition: 0,
        indirectExpansionTries: 0,
        invalidEnvName: 0,
        notExistingEnv: 0
    };

    while (true) {
        const prefixIndex = result.indexOf(envPrefix, startIndex);
        if (prefixIndex < 0) {
            break;
        }

        telemetry.foundPrefixes++;

        if (result[prefixIndex - 1] === escapingSymbol) {
            if (!(result[prefixIndex - 2]) || result[prefixIndex - 2] !== escapingSymbol) {
                startIndex++;
                result = result.substring(0, prefixIndex - 1) + result.substring(prefixIndex);

                telemetry.escapedVariables++;

                continue;
            }

            telemetry.escapedEscapingSymbols++;
        }

        const quoteIndex = result.indexOf(quote, startIndex);
        if (quoteIndex >= 0 && prefixIndex > quoteIndex) {
            const nextQuoteIndex = result.indexOf(quote, quoteIndex + 1);
            if (nextQuoteIndex < 0) {
                telemetry.unmatchedQuotes = 1;
                break;
            }

            startIndex = nextQuoteIndex + 1;

            telemetry.quottedBlocks++;

            continue;
        }

        let envName = '';
        let envEndIndex = 0;
        let isBraceSyntax = false;

        if (result[prefixIndex + 1] === '{') {
            isBraceSyntax = true;

            telemetry.braceSyntaxEntries++;
        }

        const envStartIndex = prefixIndex + envPrefix.length + +isBraceSyntax;

        if (isBraceSyntax) {
            envEndIndex = findEnclosingBraceIndex(result, prefixIndex);
            if (envEndIndex === 0) {
                telemetry.notClosedBraceSyntaxPosition = prefixIndex + 1;
                break;
            }

            if (result[prefixIndex + envPrefix.length + 1] === '!') {
                telemetry.indirectExpansionTries++;
                startIndex = envEndIndex;
                continue;
            }

            envName = result.substring(envStartIndex, envEndIndex);

            telemetry.bracedVariables++;
        } else {
            envName = result.substring(envStartIndex).split(/[ |"|'|;]/)[0];
            envEndIndex = envStartIndex + envName.length;
        }

        if (!isValidEnvName(envName)) {
            telemetry.invalidEnvName++;
            startIndex = envEndIndex;
            continue;
        }

        const head = result.substring(0, prefixIndex);
        if (!isBraceSyntax && envName.includes(escapingSymbol)) {
            telemetry.variablesWithESInside++;
        }

        let envValue = { ...process.env }[envName];
        if (!envValue) {
            telemetry.notExistingEnv++;
            startIndex = envEndIndex;
            continue;
        }

        const tail = result.substring(envEndIndex + +isBraceSyntax);

        result = head + envValue + tail;
        startIndex = prefixIndex + envValue.length;

        telemetry.variablesExpanded++;
    }

    return [result, telemetry];
}

function findEnclosingBraceIndex(input: string, targetIndex: number): number {
    for (let i = 0; i < input.length; i++) {
        if (input[i] === '}' && i > targetIndex) {
            return i;
        }
    }
    return 0;
}

function isValidEnvName(envName: string): boolean {
    const regex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return regex.test(envName);
}

export function validateScriptArgs(inputArguments: string, scriptType: string): void {
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

    tl.debug('Validating script args...');

    const isBash = (scriptType || '').toLowerCase() === 'bash';
    const [expandedArgs, envTelemetry] = isBash
        ? expandBashEnvVariables(inputArguments)
        : [inputArguments, null as BashEnvTelemetry | null];

    if (isBash) {
        tl.debug(`Expanded script args: ${expandedArgs}`);
    }

    const [sanitizedArgs, sanitizerTelemetry] = sanitizeArgs(
        expandedArgs,
        {
            argsSplitSymbols: '\\\\',
            saniziteRegExp: new RegExp(`(?<!\\\\)([^a-zA-Z0-9\\\\ _'"\\-=\\/:.*+%])`, 'g')
        }
    );

    if (sanitizedArgs === inputArguments) {
        return;
    }

    if (featureFlags.telemetry && (sanitizerTelemetry || envTelemetry)) {
        const telemetry = {
            ...(envTelemetry ?? {}),
            ...(sanitizerTelemetry ?? {})
        };
        try {
            emitTelemetry('TaskHub', 'AzureCLIV2', telemetry);
        } catch (e) {
            tl.debug(`Failed to emit script-args sanitizer telemetry: ${e}`);
        }
    }

    if (sanitizedArgs !== expandedArgs) {
        const message = tl.loc('ScriptArgsSanitized');
        if (featureFlags.activate) {
            throw new ArgsSanitizingError(message);
        }
        if (featureFlags.audit) {
            tl.warning(message, IssueSource.TaskInternal, 1);
        }
    }
}
