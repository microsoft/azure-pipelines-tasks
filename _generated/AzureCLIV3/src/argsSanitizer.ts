// Reuses the work-item-75787 argument sanitizer used by BashV3 and the
// PowerShell ArgumentsSanitizer. Three feature flags drive behavior:
//   AZP_75787_ENABLE_NEW_LOGIC      -> throw on disallowed characters
//   AZP_75787_ENABLE_NEW_LOGIC_LOG  -> warn on disallowed characters (audit)
//   AZP_75787_ENABLE_COLLECT        -> emit telemetry only
//
// The sanitizer is dispatched per scriptType so that allowlists and pre-
// expansion match the target shell:
//   * bash         -> BashV3 allowlist (a-zA-Z0-9 _'"-=/:.*+%) and $VAR /
//                     ${VAR} expansion of process env (catches value-
//                     injected secrets like VAR=";rm -rf /").
//   * pscore / ps  -> PowerShellV2 allowlist (adds \n , ~ ? # and backtick
//                     escaping, plus $true/$false via lookahead) and
//                     $env:VAR / ${env:VAR} expansion. This is what makes
//                     PowerShell-native syntax like `$env:servicePrincipalKey`
//                     or `-MyBoolean $True` pass.
//   * batch        -> Literal-only sanitization with the BashV3 allowlist
//                     (no env expansion; cmd-specific allowlist is a TODO).

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
// sanitizer runs at all. When it runs, every exception thrown by the validator
// (intentional `ArgsSanitizingError` blocks as well as unexpected errors) is
// reported as an `ArgsValidationFailure` telemetry event and then rethrown so
// the task fails.
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
        tl.debug(`validateScriptArgs threw: ${e?.message ?? err}`);
        try {
            emitTelemetry('TaskHub', 'AzureCLIV3', {
                event: 'ArgsValidationFailure',
                scriptType: (scriptType || 'unknown').toLowerCase(),
                errorName: e?.name ?? 'Unknown',
                errorMessage: e?.message ?? String(err)
            });
        } catch (telemetryErr) {
            tl.debug(`Failed to emit ArgsValidationFailure telemetry: ${telemetryErr}`);
        }
        throw err;
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

// PowerShellV2-compatible $env: / ${env:} pre-expansion. Mirrors the logic in
// Tasks/PowerShellV2/helpers.ts::expandPowerShellEnvVariables so that pscore/ps
// args are sanitized after the same expansion the PowerShell runner would do.
type ProcessEnvPowerShellTelemetry = {
    foundPrefixes: number,
    someVariablesInsideQuotes: number,
    variablesExpanded: number,
    escapedVariables: number,
    escapedEscapingSymbols: number,
    variableStartsFromBacktick: number,
    variablesWithBacktickInside: number,
    envQuottedBlocks: number,
    braceSyntaxEntries: number,
    bracedVariables: number,
    notClosedBraceSyntaxPosition: number,
    bracedEnvSyntax: number,
    notExistingEnv: number
};

export function expandPowerShellEnvVariables(argsLine: string): [string, ProcessEnvPowerShellTelemetry] {
    const basicEnvPrefix = '$env:';
    const bracedEnvPrefix = '${env:';
    const quote = '\'';
    const escapingSymbol = '`';

    const telemetry: ProcessEnvPowerShellTelemetry = {
        foundPrefixes: 0,
        someVariablesInsideQuotes: 0,
        variablesExpanded: 0,
        escapedVariables: 0,
        escapedEscapingSymbols: 0,
        variableStartsFromBacktick: 0,
        variablesWithBacktickInside: 0,
        envQuottedBlocks: 0,
        braceSyntaxEntries: 0,
        bracedVariables: 0,
        notClosedBraceSyntaxPosition: 0,
        bracedEnvSyntax: 0,
        notExistingEnv: 0
    };

    let result = argsLine;
    let startIndex = 0;

    while (true) {
        const loweredResult = result.toLowerCase();
        const basicPrefixIndex = loweredResult.indexOf(basicEnvPrefix, startIndex);
        const bracedPrefixIndex = loweredResult.indexOf(bracedEnvPrefix, startIndex);

        const foundPrefixes = [basicPrefixIndex, bracedPrefixIndex].filter(i => i >= 0);
        if (foundPrefixes.length === 0) {
            break;
        }

        const prefixIndex = Math.min(...foundPrefixes);
        const isBraceSyntax = prefixIndex === bracedPrefixIndex;
        if (isBraceSyntax) {
            telemetry.braceSyntaxEntries++;
        }

        if (prefixIndex < 0) {
            break;
        }

        telemetry.foundPrefixes++;

        if (result[prefixIndex - 1] === escapingSymbol) {
            if (!result[prefixIndex - 2] || result[prefixIndex - 2] !== escapingSymbol) {
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
                break;
            }
            startIndex = nextQuoteIndex + 1;
            continue;
        }

        let envName = '';
        let envEndIndex = 0;
        const envStartIndex = prefixIndex + (isBraceSyntax ? bracedEnvPrefix.length : basicEnvPrefix.length);

        if (isBraceSyntax) {
            envEndIndex = findEnclosingBraceIndex(result, prefixIndex);
            if (envEndIndex === 0) {
                telemetry.notClosedBraceSyntaxPosition = prefixIndex + 1;
                break;
            }
            envName = result.substring(envStartIndex, envEndIndex);
            telemetry.bracedVariables++;
        } else {
            // Note: PowerShellV2's original split is /[ |"|'|;|$]/ which fails
            // when arguments come from a YAML folded scalar (`arguments: >`)
            // because \n / \r / \t are not treated as delimiters and the env
            // name grabs across the line break. Use \s so any whitespace ends
            // the env name (matches how PowerShell tokenizes arguments).
            envName = result.substring(envStartIndex).split(/[\s|"|'|;|$]/)[0];
            envEndIndex = envStartIndex + envName.length;
        }

        if (envName.startsWith(escapingSymbol)) {
            const sanitizedEnvName = basicEnvPrefix + envName.substring(1);
            result = result.substring(0, prefixIndex) + sanitizedEnvName + result.substring(envEndIndex);
            startIndex = prefixIndex + sanitizedEnvName.length;
            telemetry.variableStartsFromBacktick++;
            continue;
        }

        let head = result.substring(0, prefixIndex);
        if (envName.includes(escapingSymbol)) {
            head = head + envName.split(escapingSymbol)[1];
            envName = envName.split(escapingSymbol)[0];
            telemetry.variablesWithBacktickInside++;
        }

        const envValue = process.env[envName];
        if (!envValue) {
            telemetry.notExistingEnv++;
            startIndex = envEndIndex;
            continue;
        }

        const tail = result.substring(isBraceSyntax ? envEndIndex + 1 : envEndIndex);
        result = head + envValue + tail;
        startIndex = prefixIndex + envValue.length;
        telemetry.variablesExpanded++;
    }

    return [result, telemetry];
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

    const normalizedScriptType = (scriptType || '').toLowerCase();
    const isBash = normalizedScriptType === 'bash';
    const isPowerShell = normalizedScriptType === 'pscore' || normalizedScriptType === 'ps';

    let expandedArgs = inputArguments;
    let envTelemetry: BashEnvTelemetry | ProcessEnvPowerShellTelemetry | null = null;

    if (isBash) {
        [expandedArgs, envTelemetry] = expandBashEnvVariables(inputArguments);
        tl.debug(`Expanded script args: ${expandedArgs}`);
    } else if (isPowerShell) {
        [expandedArgs, envTelemetry] = expandPowerShellEnvVariables(inputArguments);
        tl.debug(`Expanded script args: ${expandedArgs}`);
    }

    const [sanitizedArgs, sanitizerTelemetry] = isPowerShell
        ? sanitizeArgs(expandedArgs, {
            // PowerShellV2 allowlist: word chars + \ ` _ ' " - = / : . * , + ~ ? % \n #
            // Backtick is PowerShell's escape symbol; (?!true|false) lets $True / $false pass.
            argsSplitSymbols: '``',
            saniziteRegExp: new RegExp("(?<!`)([^\\w\\\\` _'\"\\-=\\/:\\.*,+~?%\\n#])(?!true|false)", 'ig')
        })
        : sanitizeArgs(expandedArgs, {
            // BashV3 allowlist (also used for batch and unknown scriptType).
            argsSplitSymbols: '\\\\',
            saniziteRegExp: new RegExp("(?<!\\\\)([^a-zA-Z0-9\\\\ _'\"\\-=\\/:.*+%])", 'g')
        });

    if (sanitizedArgs === inputArguments) {
        return;
    }

    if (featureFlags.telemetry && (sanitizerTelemetry || envTelemetry)) {
        const telemetry = {
            scriptType: normalizedScriptType || 'unknown',
            ...(envTelemetry ?? {}),
            ...(sanitizerTelemetry ?? {})
        };
        try {
            emitTelemetry('TaskHub', 'AzureCLIV3', telemetry);
        } catch (e) {
            tl.debug(`Failed to emit script-args sanitizer telemetry: ${e}`);
        }
    }

    if (sanitizedArgs !== expandedArgs) {
        const offendingChars = collectOffendingChars(
            (sanitizerTelemetry as { removedSymbols?: Record<string, number> } | null)?.removedSymbols
        );
        let message = tl.loc('ScriptArgsSanitized');
        if (offendingChars) {
            message = `${message} Offending characters: ${offendingChars}.`;
        }
        if (featureFlags.activate) {
            throw new ArgsSanitizingError(message);
        }
        if (featureFlags.audit) {
            tl.warning(message, IssueSource.TaskInternal, 1);
        }
    }
}

// Build a human-readable list of the disallowed characters that were removed
// during sanitization, so the error message names exactly what to fix.
// Whitespace characters (\n, \r, \t) are excluded because they typically come
// from YAML folded scalars (`arguments: >`) rather than from author intent;
// they are still counted in telemetry via removedSymbols.
function collectOffendingChars(removedSymbols: Record<string, number> | undefined): string {
    if (!removedSymbols) {
        return '';
    }
    const whitespace = new Set(['\n', '\r', '\t']);
    const chars = Object.keys(removedSymbols).filter(c => !whitespace.has(c));
    if (chars.length === 0) {
        return '';
    }
    return chars.map(c => `'${c}'`).join(', ');
}
