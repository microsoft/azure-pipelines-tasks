function parsePowerShellArguments([string]$InputArgs) {

    $escapingSymbol = '`'
    $quoteTypes = @("'", '"')

    $resultArgs = [array]@()
    $currentArg = ''
    $escaped = $false
    $activeQuote = ''
    $passiveQuote = ''

    $processedArgs, $envTelemetry = Expand-EnvVariables -ArgsLine $InputArgs

    $telemetry = @{
        nestedQuotes               = 0
        closedQuotePairs           = 0
        escapedQuotes              = 0
        backticks                  = 0
        escapedBackticks           = 0
        backticksInSingleQuotes    = 0
        specialCharacters          = 0
        # possibly blockers
        unbalancedQuotes           = 0 # "1 '2" / '1 "2'
        # blockers
        unmatchedQuotes            = 0
        lastCharMeaningfulBacktick = 0
    } + $envTelemetry

    $chars = $processedArgs.ToCharArray()

    foreach ($currentChar in $chars) {
        if ($currentChar -eq ' ') {
            if ($activeQuote) {
                $currentArg += $currentChar
            }
            else {
                if ($currentArg) {
                    $resultArgs += $currentArg
                    if ($escaped) {
                        $telemetry.lastCharMeaningfulBacktick++
                    }
                }

                $currentArg = ''
            }

            continue
        }

        if ($currentChar -eq $escapingSymbol) {
            $telemetry.backticks++
            if ($escaped) {
                $currentArg += $currentChar
                $escaped = $false
                $telemetry.escapedBackticks++

                continue
            }
            if ($activeQuote -eq "'") {
                $currentArg += $currentChar
                $telemetry.backticksInSingleQuotes++

                continue
            }

            $escaped = $true

            continue
        }

        if ($quoteTypes -contains $currentChar) {
            if ($escaped) {
                $currentArg += $currentChar
                $escaped = $false
                $telemetry.escapedQuotes++

                continue
            }
            if ($currentChar -eq $activeQuote) {
                $activeQuote = ''
                $telemetry.closedQuotePairs++

                if ($passiveQuote) {
                    $passiveQuote = ''
                    $telemetry.unbalancedQuotes++
                }

                continue
            }
            if ($activeQuote) {
                $currentArg += $currentChar
                $escaped = $false
                $telemetry.nestedQuotes++

                $passiveQuote = $passiveQuote ? '' : $currentChar


                continue
            }
            $activeQuote = $currentChar

            continue
        }

        $currentArg += $currentChar
        $escaped = $false

        if ($specialCharacters -contains $currentArg) {
            $telemetry.specialCharacters++
        }
    }

    if ($currentArg) {
        $resultArgs += $currentArg
        if ($escaped) {
            $telemetry.lastCharMeaningfulBacktick++
        }
    }

    if ($activeQuote) {
        $telemetry.unmatchedQuotes = 1
    }

    return @($resultArgs, $telemetry)
}

function Expand-EnvVariables([string]$ArgsLine) {
    $envPrefix = '$env:'
    $quote = "'"
    $escapingSymbol = '`'

    $telemetry = @{
        foundPrefixes               = 0
        someVariablesInsideQuotes   = 0
        variablesExpanded           = 0
        escapedVariables            = 0
        escapedEscapingSymbols      = 0
        variableStartsFromBacktick  = 0
        variablesWithBacktickInside = 0
        envQuottedBlocks            = 0
        envUnmatchedQuotes          = 0
    }
    $result = $ArgsLine
    $startIndex = 0

    while ($true) {
        $prefixIndex = $result.ToLower().IndexOf($envPrefix, $startIndex)
        if ($prefixIndex -lt 0) {
            break;
        }

        $telemetry.foundPrefixes++

        if ($result[$prefixIndex - 1] -eq $escapingSymbol) {
            if (-not $result[$prefixIndex - 2] -or $result[$prefixIndex - 2] -ne $escapingSymbol) {
                $startIndex++
                $result = $result.Substring(0, $prefixIndex - 1) + $result.Substring($prefixIndex)

                $telemetry.escapedVariables++

                continue
            }

            $telemetry.escapedEscapingSymbols++
        }

        $quoteIndex = $result.IndexOf($quote, $startIndex)
        if ($quoteIndex -ge 0 -and $prefixIndex -gt $quoteIndex) {
            $nextQuoteIndex = $result.IndexOf($quote, $quoteIndex + 1)
            if ($nextQuoteIndex -lt 0) {
                $telemetry.envUnmatchedQuotes = 1
                # we properly should throw error here
                # throw new Error('Quotes not enclosed.')
                break
            }

            $startIndex = $nextQuoteIndex + 1

            $telemetry.envQuottedBlocks++

            continue
        }

        $envName = ''
        $envEndIndex = 0

        $envStartIndex = $prefixIndex + $envPrefix.Length

        $envName = $result.Substring($envStartIndex).Split(' ', '"', "'", ';', '$')[0]
        $envEndIndex = $envStartIndex + $envName.Length

        if ($envName.StartsWith($escapingSymbol)) {
            $sanitizedEnvName = '$env:' + $envName.Substring(1)
            $result = $result.Substring(0, $prefixIndex) + $sanitizedEnvName + $result.Substring($envEndIndex)
            $startIndex = $prefixIndex + $sanitizedEnvName.Length

            $telemetry.variableStartsFromBacktick++

            continue
        }

        $head = $result.Substring(0, $prefixIndex)
        if ($envName.Contains($escapingSymbol)) {
            $head = $head + $envName.Split($escapingSymbol)[1]
            $envName = $envName.Split($escapingSymbol)[0]

            $telemetry.variablesWithBacktickInside++
        }

        $envValue = [Environment]::GetEnvironmentVariable($envName, [System.EnvironmentVariableTarget]::Process)
        if (!$envValue) {
            $envValue = ''
        }
        $tail = $result.Substring($envEndIndex)

        $result = $head + $envValue + $tail
        $startIndex = $prefixIndex + $envValue.Length

        $telemetry.variablesExpanded++

        continue
    }

    return $($result, $telemetry)
}
