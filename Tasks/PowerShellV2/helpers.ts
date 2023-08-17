import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from "azure-pipelines-tasks-utility-common/telemetry"
import { ArgsSanitizingError } from './utils/errors';

type ProcessEnvPowerShellTelemetry = {
    foundPrefixes: number,
    someVariablesInsideQuotes: number,
    variablesExpanded: number,
    escapedVariables: number,
    escapedEscapingSymbols: number,
    variableStartsFromBacktick: number,
    variablesWithBacktickInside: number,
    envQuottedBlocks: number,
    // blockers
    bracedEnvSyntax: number,
    expansionSyntax: number,
    unmatchedExpansionSyntax: number
}

export function expandPowerShellEnvVariables(argsLine: string): [string, ProcessEnvPowerShellTelemetry] {
    const envPrefix = '$env:'
    const quote = '\''
    const escapingSymbol = '`'
    const expansionPrefix = '$('
    const expansionSuffix = ')'

    const telemetry: ProcessEnvPowerShellTelemetry = {
        foundPrefixes: 0,
        someVariablesInsideQuotes: 0,
        variablesExpanded: 0,
        escapedVariables: 0,
        escapedEscapingSymbols: 0,
        variableStartsFromBacktick: 0,
        variablesWithBacktickInside: 0,
        envQuottedBlocks: 0,
        // blockers
        bracedEnvSyntax: 0,
        expansionSyntax: 0,
        unmatchedExpansionSyntax: 0
    }

    let result = argsLine
    let startIndex = 0

    while (true) {
        const quoteIndex = result.indexOf(quote, startIndex)
        if (quoteIndex >= 0) {
            const nextQuoteIndex = result.indexOf(quote, quoteIndex + 1)
            if (nextQuoteIndex < 0) {
                break
            }

            startIndex = nextQuoteIndex + quote.length
            telemetry.envQuottedBlocks++
            continue
        }

        const expansionPrefixIndex = result.indexOf(expansionPrefix, startIndex)
        if (expansionPrefixIndex >= 0) {
            const expansionSuffixIndex = result.indexOf(expansionSuffix, startIndex)
            if (expansionSuffixIndex < 0) {
                telemetry.unmatchedExpansionSyntax++;
                break;
            }

            startIndex = expansionSuffixIndex + expansionSuffix.length
            telemetry.expansionSyntax++
            continue
        }

        let prefixIndex = result.toLowerCase().indexOf(envPrefix, startIndex)

        if (prefixIndex < 0) {
            prefixIndex = result.toLowerCase().indexOf('${env:', startIndex)
            if (prefixIndex < 0) {
                break;
            }
            telemetry.bracedEnvSyntax++
            break;
        }

        telemetry.foundPrefixes++

        if (result[prefixIndex - 1] === escapingSymbol) {
            if (!result[prefixIndex - 2] || result[prefixIndex - 2] !== escapingSymbol) {
                startIndex++
                result = result.substring(0, prefixIndex - 1) + result.substring(prefixIndex)

                telemetry.escapedVariables++

                continue
            }

            telemetry.escapedEscapingSymbols++
        }

        let envName = '';
        let envEndIndex = 0;

        const envStartIndex = prefixIndex + envPrefix.length

        envName = result.substring(envStartIndex).split(/[ |"|'|;|$]/)[0]
        envEndIndex = envStartIndex + envName.length

        if (envName.startsWith(escapingSymbol)) {
            const sanitizedEnvName = '$env:' + envName.substring(1)
            result = result.substring(0, prefixIndex) + sanitizedEnvName + result.substring(envEndIndex)
            startIndex = prefixIndex + sanitizedEnvName.length

            telemetry.variableStartsFromBacktick++

            continue
        }

        let head = result.substring(0, prefixIndex)
        if (envName.includes(escapingSymbol)) {
            head = head + envName.split(escapingSymbol)[1]
            envName = envName.split(escapingSymbol)[0]

            telemetry.variablesWithBacktickInside++
        }

        const envValue = process.env[envName] ?? '';
        const tail = result.substring(envEndIndex)

        result = head + envValue + tail;
        startIndex = prefixIndex + envValue.length

        telemetry.variablesExpanded++

        continue
    }

    return [result, telemetry]
}

export function validateFileArgs(inputArguments: string): void {
    const featureFlags = {
        audit: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC_LOG'),
        activate: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC'),
        telemetry: tl.getBoolFeatureFlag('AZP_75787_ENABLE_COLLECT')
    };

    if (featureFlags.activate || featureFlags.audit || featureFlags.telemetry) {
        tl.debug('Validating file args');
        const [expandedArgs, expandTelemetry] = expandPowerShellEnvVariables(inputArguments);

        tl.debug(`Expanded args: ${expandedArgs}`);

        const [sanitizedArgs, sanitizeTelemetry] = sanitizeArgs(
            expandedArgs,
            {
                argsSplitSymbols: '``',
            }
        );
        if (sanitizedArgs !== inputArguments) {
            if (featureFlags.telemetry && (sanitizeTelemetry || expandTelemetry)) {
                const telemetry = {
                    ...expandTelemetry ?? {},
                    ...sanitizeTelemetry ?? {}
                };
                emitTelemetry('TaskHub', 'BashV3', telemetry);
            }
            if (sanitizedArgs !== expandedArgs) {
                const message = tl.loc('ScriptArgsSanitized');
                if (featureFlags.activate) {
                    throw new ArgsSanitizingError(message);
                }
                if (featureFlags.audit) {
                    tl.warning(message);
                }
            }
        }
    }
}
