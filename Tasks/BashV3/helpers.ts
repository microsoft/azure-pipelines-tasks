import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from "azure-pipelines-tasks-utility-common/telemetry";
import { ArgsSanitizingError } from './utils/errors';

type BashEnvTelemetry = {
    foundPrefixes: number,
    quottedBlocks: number,
    variablesExpanded: number,
    escapedVariables: number,
    escapedEscapingSymbols: number,
    variablesStartsFromES: number,
    braceSyntaxEntries: number,
    bracedVariables: number,
    // possibly blockers
    variablesWithESInside: number,
    // blockers
    unmatchedQuotes: number, // like "Hello, world!
    notClosedBraceSyntaxPosition: number, // 0 means no this issue,
    indirectExpansion: number,
    invalidEnvName: number,
}

export function expandBashEnvVariables(argsLine: string): [string, BashEnvTelemetry] {
    const envPrefix = '$'
    const quote = '\''
    const escapingSymbol = '\\'

    let result = argsLine
    let startIndex = 0
    // backslash - just backslash
    // ES (escaping symbol) - active backslash
    const telemetry: BashEnvTelemetry = {
        foundPrefixes: 0,
        quottedBlocks: 0,
        variablesExpanded: 0,
        escapedVariables: 0,
        escapedEscapingSymbols: 0,
        variablesStartsFromES: 0,
        braceSyntaxEntries: 0,
        bracedVariables: 0,
        // possibly blockers
        variablesWithESInside: 0,
        // blockers
        unmatchedQuotes: 0, // like "Hello, world!
        notClosedBraceSyntaxPosition: 0,
        indirectExpansion: 0,
        invalidEnvName: 0 // 0 means no this issue,
    }

    for (let i = 0; i < argsLine.length; i++) {
        const prefixIndex = result.indexOf(envPrefix, startIndex)
        if (prefixIndex < 0) {
            break;
        }

        telemetry.foundPrefixes++

        if (result[prefixIndex - 1] === escapingSymbol) {
            if (!(result[prefixIndex - 2]) || result[prefixIndex - 2] !== escapingSymbol) {
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
                telemetry.unmatchedQuotes = 1
                // we properly should throw error here
                // throw new Error('Quotes not enclosed.')
                break
            }

            startIndex = nextQuoteIndex + 1

            telemetry.quottedBlocks++

            continue
        }

        let envName = '';
        let envEndIndex = 0;
        let isBraceSyntax = false

        if (result[prefixIndex + 1] === '{') {
            isBraceSyntax = true

            telemetry.braceSyntaxEntries++
        }

        const envStartIndex = prefixIndex + envPrefix.length + +isBraceSyntax

        if (isBraceSyntax) {
            envEndIndex = findEnclosingBraceIndex(result, prefixIndex)
            if (envEndIndex === 0) {
                // startIndex++

                telemetry.notClosedBraceSyntaxPosition = prefixIndex + 1 // +{
                // throw new Error(...)
                break;
                // continue
            }

            if (result[prefixIndex + envPrefix.length + 1] === '!') {
                telemetry.indirectExpansion++
                // We're just skipping indirect expansion
                startIndex = envEndIndex
                continue
            }

            envName = result.substring(envStartIndex, envEndIndex)

            telemetry.bracedVariables++
        } else {
            envName = result.substring(envStartIndex).split(/[ |"|'|;]/)[0]
            envEndIndex = envStartIndex + envName.length
        }

        if (!isBraceSyntax && envName.startsWith(escapingSymbol)) {
            const sanitizedEnvName = '$' + (isBraceSyntax ? '{' : '') + envName.substring(1) + (isBraceSyntax ? '}' : '')
            result = result.substring(0, prefixIndex) + sanitizedEnvName + result.substring(envEndIndex + +isBraceSyntax)
            startIndex = prefixIndex + sanitizedEnvName.length

            telemetry.variablesStartsFromES++

            continue
        }

        let head = result.substring(0, prefixIndex)
        if (!isBraceSyntax && envName.includes(escapingSymbol)) {
            head = head + envName.split(escapingSymbol)[1]
            envName = envName.split(escapingSymbol)[0]

            telemetry.variablesWithESInside++
        }

        if (!isValidEnvName(envName)) {
            telemetry.invalidEnvName++
            startIndex = envEndIndex
            continue
        }

        const envValue = process.env[envName] ?? '';
        const tail = result.substring(envEndIndex + +isBraceSyntax)

        result = head + envValue + tail
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

function isValidEnvName(envName) {
    const regex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return regex.test(envName);
}

export function validateFileArgs(inputArguments: string): void {
    const featureFlags = {
        audit: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC_LOG'),
        activate: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC'),
        telemetry: tl.getBoolFeatureFlag('AZP_75787_ENABLE_COLLECT')
    };

    if (featureFlags.activate || featureFlags.audit || featureFlags.telemetry) {
        tl.debug('Validating file args...');
        const [expandedArgs, envTelemetry] = expandBashEnvVariables(inputArguments);
        tl.debug(`Expanded file args: ${expandedArgs}`);

        const [sanitizedArgs, sanitizerTelemetry] = sanitizeArgs(
            expandedArgs,
            {
                argsSplitSymbols: '\\\\',
                saniziteRegExp: new RegExp(`(?<!\\\\)([^a-zA-Z0-9\\\\ _'"\\-=\\/:.])`, 'g')
            }
        );
        if (sanitizedArgs !== inputArguments) {
            if (featureFlags.telemetry && (sanitizerTelemetry || envTelemetry)) {
                const telemetry = {
                    ...envTelemetry ?? {},
                    ...sanitizerTelemetry ?? {}
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
