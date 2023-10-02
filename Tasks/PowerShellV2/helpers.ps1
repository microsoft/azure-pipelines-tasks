function Publish-Telemetry($Telemetry) {
    $area = 'TaskHub'
    $feature = 'PowerShellV2'
    $telemetryJson = $Telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}

function Merge-Matches {
    param (
        [Parameter(Mandatory = $true)]
        [String[]]$Matches
    )

    $matchesData = @{}
    foreach ($m in $Matches) {
        if ($matchesData.ContainsKey($m)) {
            $matchesData[$m]++
        }
        else {
            $matchesData[$m] = 1
        }
    }

    return $matchesData
}

function Sanitize-Arguments([string]$InputArgs) {
    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';
    [string[][]]$matchesChunks = @()

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $InputArgs -split $argsSplitSymbols;

    ## '?<!`' - checking if before character no backtick. '^a-zA-Z0-9` _'"-=\/:\.*,+~?%\n' - checking if character is allowed. Insead replacing to #removed#
    $regex = '(?<!`)([^a-zA-Z0-9\\` _''"\-=\/:\.*,+~?%\n])'
    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        [string[]]$matches = (Select-String $regex -input $argsArr[$i] -AllMatches) | ForEach-Object { $_.Matches }
        if ($null -ne $matches ) {
            $matchesChunks += , $matches;
            $argsArr[$i] = $argsArr[$i] -replace $regex, $removedSymbolSign;
        }
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    $telemetry = $null
    if ( $resultArgs -ne $InputArgs) {
        $argMatches = $matchesChunks | ForEach-Object { $_ } | Where-Object { $_ -ne $null }
        $telemetry = @{
            removedSymbols      = Merge-Matches -Matches $argMatches
            removedSymbolsCount = $argMatches.Count
        }
    }

    return , $resultArgs, $telemetry;
}

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

function Test-FileArgs([string]$inputArguments) {
    $featureFlags = @{
        audit     = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC_LOG)
        activate  = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC)
        telemetry = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_COLLECT)
    }

    ## get values of all keys
    Write-Debug "Feature flags state: $($featureFlags | ConvertTo-Json -Compress)"

    if ($featureFlags.activate -or $featureFlags.audit -or $featureFlags.telemetry) {
        Write-Debug "Validating file arguments."
        $expandedArgs, $expandTelemetry = Expand-EnvVariables $inputArguments;

        $sanitizedArgs, $sanitizerTelemetry = Sanitize-Arguments -InputArgs $expandedArgs;

        if ($sanitizedArgs -ne $inputArguments) {
            if ($featureFlags.telemetry -and (($null -ne $sanitizerTelemetry) -or ($null -ne $expandTelemetry))) {
                $telemetry = $expandTelemetry;
                if ($null -ne $sanitizerTelemetry) {
                    $telemetry += $sanitizerTelemetry;
                }
                Publish-Telemetry $telemetry;
            }

            if ($sanitizedArgs -ne $expandedArgs) {
                $message = Get-VstsLocString -Key 'ScriptArgsSanitized';
                if ($featureFlags.activate) {
                    throw $message;
                }
                if ($featureFlags.audit) {
                    Write-Warning $message;
                }
            }
        }
    }
}
