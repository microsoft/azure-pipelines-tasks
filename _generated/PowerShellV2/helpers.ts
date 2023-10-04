import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from "azure-pipelines-tasks-utility-common/telemetry"
import { ArgsSanitizingError } from './errors';

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
    // blockers
    bracedEnvSyntax: number,
    notExistingEnv: number
}

export function expandPowerShellEnvVariables(argsLine: string): [string, ProcessEnvPowerShellTelemetry] {
    const basicEnvPrefix = '$env:'
    const bracedEnvPrefix = '${env:'
    const quote = '\''
    const escapingSymbol = '`'

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
        // blockers
        bracedEnvSyntax: 0,
        notExistingEnv: 0
    }

    let result = argsLine
    let startIndex = 0

    while (true) {
        const loweredResult = result.toLowerCase()
        const basicPrefixIndex = loweredResult.indexOf(basicEnvPrefix, startIndex)
        const bracedPrefixIndex = loweredResult.indexOf(bracedEnvPrefix, startIndex)

        const foundPrefixes = [basicPrefixIndex, bracedPrefixIndex].filter(i => i >= 0)
        if (foundPrefixes.length === 0) {
            break;
        }

        const prefixIndex = Math.min(...foundPrefixes)

        const isBraceSyntax = prefixIndex === bracedPrefixIndex
        if (isBraceSyntax) {
            telemetry.braceSyntaxEntries++;
        }

        if (prefixIndex < 0) {
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

        const quoteIndex = result.indexOf(quote, startIndex)
        if (quoteIndex >= 0 && prefixIndex > quoteIndex) {
            const nextQuoteIndex = result.indexOf(quote, quoteIndex + 1)
            if (nextQuoteIndex < 0) {
                break
            }

            startIndex = nextQuoteIndex + 1

            continue
        }

        let envName = '';
        let envEndIndex = 0;

        const envStartIndex = prefixIndex + (isBraceSyntax ? bracedEnvPrefix.length : basicEnvPrefix.length)

        if (isBraceSyntax) {
            envEndIndex = findEnclosingBraceIndex(result, prefixIndex)
            if (envEndIndex === 0) {
                telemetry.notClosedBraceSyntaxPosition = prefixIndex + 1 // +{

                break;
            }

            envName = result.substring(envStartIndex, envEndIndex)

            telemetry.bracedVariables++
        } else {
            envName = result.substring(envStartIndex).split(/[ |"|'|;|$]/)[0]
            envEndIndex = envStartIndex + envName.length
        }

        if (envName.startsWith(escapingSymbol)) {
            const sanitizedEnvName = basicEnvPrefix + envName.substring(1)
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

        const envValue = process.env[envName];
        // in case we don't have such variable, we just leave it as is
        if (!envValue) {
            telemetry.notExistingEnv++
            startIndex = envEndIndex
            continue
        }

        const tail = result.substring(isBraceSyntax ? envEndIndex + 1 : envEndIndex)

        result = head + envValue + tail;
        startIndex = prefixIndex + envValue.length

        telemetry.variablesExpanded++

        continue
    }

    return [result, telemetry]
}

function findEnclosingBraceIndex(input: string, targetIndex: number) {
    for (let i = 0; i < input.length; i++) {
        if (input[i] === "}" && i > targetIndex) {
            return i
        }
    }
    return 0
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
                saniziteRegExp: new RegExp('(?<!`)([^a-zA-Z0-9\\\\` _\'"\\-=\\/:\\.*,+~?%])', 'g')
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
