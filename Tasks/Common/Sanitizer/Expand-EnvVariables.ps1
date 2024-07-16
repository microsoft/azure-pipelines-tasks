function Expand-EnvVariables([string]$ArgsLine) {
    $basicEnvPrefix = '$env:'
    $bracedEnvPrefix = '${env:'
    $quote = "'"
    $escapingSymbol = '`'

    $telemetry = @{
        foundPrefixes                = 0
        someVariablesInsideQuotes    = 0
        variablesExpanded            = 0
        escapedVariables             = 0
        escapedEscapingSymbols       = 0
        variableStartsFromBacktick   = 0
        variablesWithBacktickInside  = 0
        envQuottedBlocks             = 0
        braceSyntaxEntries           = 0
        bracedVariables              = 0
        notClosedBraceSyntaxPosition = 0
        # blockers
        bracedEnvSyntax              = 0
        expansionSyntax              = 0
        unmatchedExpansionSyntax     = 0
        notExistingEnv               = 0
    }

    $result = $ArgsLine
    $startIndex = 0

    while ($true) {
        $loweredResult = $result.ToLower()
        $basicPrefixIndex = $loweredResult.IndexOf($basicEnvPrefix, $startIndex)
        $bracedPrefixIndex = $loweredResult.IndexOf($bracedEnvPrefix, $startIndex)
        $foundPrefixes = @($basicPrefixIndex, $bracedPrefixIndex) | Where-Object { $_ -ge 0 }
        if ($foundPrefixes.Count -eq 0) {
            break;
        }

        $prefixIndex = $foundPrefixes | Measure-Object -Minimum | Select-Object -ExpandProperty Minimum

        [bool]$isBraceSyntax = $prefixIndex -eq $bracedPrefixIndex
        if ($isBraceSyntax) {
            $telemetry.braceSyntaxEntries++
        }

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
                break
            }

            $startIndex = $nextQuoteIndex + 1

            continue
        }

        $envName = ''
        $envEndIndex = 0

        $envStartIndex = $prefixIndex;
        if ($isBraceSyntax) {
            $envStartIndex += $bracedEnvPrefix.Length
        }
        else {
            $envStartIndex += $basicEnvPrefix.Length
        }

        if ($isBraceSyntax) {
            $envEndIndex = Find-EnclosingBraceIndex $result $prefixIndex
            if ($envEndIndex -eq 0) {
                $telemetry.notClosedBraceSyntaxPosition = $prefixIndex + 1 # +{

                break
            }

            $envName = $result.Substring($envStartIndex, $envEndIndex - $envStartIndex)

            $telemetry.bracedVariables++
        }
        else {
            $envName = $result.Substring($envStartIndex).Split(' ', '"', "'", ';', '$')[0]
            $envEndIndex = $envStartIndex + $envName.Length
        }

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

        $envValue = [Environment]::GetEnvironmentVariable($envName, 'Process')
        if (!$envValue) {
            $telemetry.notExistingEnv++
            $startIndex = $envEndIndex
            continue
        }

        if ($isBraceSyntax) {
            $envEndIndex++
        }

        $tail = $result.Substring($envEndIndex)

        $result = $head + $envValue + $tail
        $startIndex = $prefixIndex + $envValue.Length

        $telemetry.variablesExpanded++

        continue
    }

    return $($result, $telemetry)
}

function Find-EnclosingBraceIndex($tail, $targetIndex) {
    for ($i = 0; $i -lt $tail.Length; $i++) {
        if ($tail[$i] -eq "}" -and $i -gt $targetIndex) {
            return $i
        }
    }
    return 0
}
