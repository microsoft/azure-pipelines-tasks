import * as uuidV4 from 'uuid/v4';

class EnvDelimitierHelper {
    public readonly delimitier: string = `#AzpEnvDelim#${uuidV4()}&`

    public isEnvDelimitierProcessing: boolean = false;
    public isEnvVariableProcessing: boolean = false;
    public delimAcc: string = ''

    public get delimitierFirstLetter(): string {
        return this.delimitier[0];
    }

    public get delimitierLastLetter(): string {
        return this.delimitier[this.delimitier.length - 1];
    }

    public get isDelimiterFinished(): boolean {
        return this.delimAcc === this.delimitier
    }

    public isNextLettersAreDelimitier(input: string): boolean {
        const slice = input.slice(0, this.delimitier.length)

        return slice === this.delimitier
    }
}

const dHelper = new EnvDelimitierHelper();

type PowerShellTelemetry = {
    nestedQuotes: number,
    closedQuotePairs: number,
    escapedQuotes: number,
    backticks: number,
    escapedBackticks: number,
    backticksInSingleQuotes: number,
    specialCharacters: number,
    // possibly blockers
    unbalancedQuotes: number, // "1 '2" / '1 "2'
    // blockers
    unmatchedQuotes: number,
    lastCharMeaningfulBacktick: number,
} & ProcessEnvPowerShellTelemetry

export function parsePowerShellArguments(inputArgs: string): [string[], PowerShellTelemetry] {
    const escapingSymbol = '`'
    const quoteTypes = ['\'', '"']
    const specialCharacters = ['$', ';', '@', '&']

    const resultArgs: string[] = []
    let currentArg = ''
    let escaped = false
    let activeQuote = ''
    let passiveQuote = ''

    const [processedArgs, envTelemetry] = processPowerShellEnVariables(inputArgs)

    const telemetry = {
        ...envTelemetry,
        nestedQuotes: 0,
        closedQuotePairs: 0,
        escapedQuotes: 0,
        backticks: 0,
        escapedBackticks: 0,
        backticksInSingleQuotes: 0,
        specialCharacters: 0,
        // possibly blockers
        unbalancedQuotes: 0, // "1 '2" / '1 "2'
        // blockers
        unmatchedQuotes: 0,
        lastCharMeaningfulBacktick: 0,
    }

    for (let i = 0; i < processedArgs.length; i++) {
        const currentChar = processedArgs[i]

        if (dHelper.isEnvDelimitierProcessing) {
            dHelper.delimAcc += currentChar;

            if (dHelper.isDelimiterFinished) {
                dHelper.isEnvDelimitierProcessing = false;
                dHelper.isEnvVariableProcessing = !dHelper.isEnvVariableProcessing;
                dHelper.delimAcc = ''
            }

            continue
        }

        if (currentChar === dHelper.delimitierFirstLetter) {
            if (dHelper.isNextLettersAreDelimitier(processedArgs.slice(i))) {
                dHelper.isEnvDelimitierProcessing = true;
                dHelper.delimAcc += currentChar;

                continue
            }
        }

        if (dHelper.isEnvVariableProcessing) {
            currentArg += currentChar

            continue
        }

        if (currentChar === ' ') {
            if (activeQuote) {
                currentArg += currentChar
            } else {
                currentArg && resultArgs.push(currentArg)
                escaped && telemetry.lastCharMeaningfulBacktick++

                currentArg = ''
            }

            continue
        }

        if (currentChar === escapingSymbol) {
            telemetry.backticks++
            if (escaped) {
                currentArg += currentChar
                escaped = false
                telemetry.escapedBackticks++

                continue
            }
            if (activeQuote === '\'') {
                currentArg += currentChar
                telemetry.backticksInSingleQuotes++

                continue
            }

            escaped = true

            continue
        }

        if (quoteTypes.includes(currentChar)) {
            if (escaped) {
                currentArg += currentChar
                escaped = false
                telemetry.escapedQuotes++

                continue
            }
            if (currentChar === activeQuote) {
                activeQuote = ''
                telemetry.closedQuotePairs++

                if (passiveQuote) {
                    passiveQuote = ''
                    telemetry.unbalancedQuotes++
                }

                continue
            }
            if (activeQuote) {
                currentArg += currentChar
                escaped = false
                telemetry.nestedQuotes++

                passiveQuote = passiveQuote ? '' : currentChar

                continue
            }
            activeQuote = currentChar

            continue
        }

        currentArg += currentChar
        escaped = false

        if (specialCharacters.includes(currentArg)) {
            telemetry.specialCharacters++
        }
    }

    currentArg && resultArgs.push(currentArg)
    escaped && telemetry.lastCharMeaningfulBacktick++

    if (activeQuote) {
        telemetry.unmatchedQuotes = 1
    }

    return [resultArgs, telemetry]
}

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

function processPowerShellEnVariables(argsLine: string): [string, ProcessEnvPowerShellTelemetry] {
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

        result = head + dHelper.delimitier + envValue + dHelper.delimitier + tail;
        startIndex = prefixIndex + envValue.length

        telemetry.variablesExpanded++

        continue
    }

    return [result, telemetry]
}
