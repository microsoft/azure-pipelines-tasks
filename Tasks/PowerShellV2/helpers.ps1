function Publish-Telemetry($Telemetry) {
    Assert-VstsAgent -Minimum '2.115.0'
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

    ## '?<!`' - checking if before character no backtick. '^a-zA-Z0-9` _'"-' - checking if character is allowed. Insead replacing to #removed#
    $regex = '(?<!`)([^a-zA-Z0-9\\` _''"\-=\/:\.])'
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
    $envPrefix = '$env:'
    $quote = "'"
    $escapingSymbol = '`'
    $expansionPrefix = '$('
    $expansionSuffix = ')'

    $telemetry = @{
        foundPrefixes               = 0
        someVariablesInsideQuotes   = 0
        variablesExpanded           = 0
        escapedVariables            = 0
        escapedEscapingSymbols      = 0
        variableStartsFromBacktick  = 0
        variablesWithBacktickInside = 0
        envQuottedBlocks            = 0
        # blockers
        bracedEnvSyntax             = 0
        expansionSyntax             = 0
        unmatchedExpansionSyntax    = 0
    }
    $result = $ArgsLine
    $startIndex = 0

    while ($true) {
        $quoteIndex = $result.IndexOf($quote, $startIndex)
        if ($quoteIndex -ge 0) {
            $nextQuoteIndex = $result.IndexOf($quote, $quoteIndex + 1)
            if ($nextQuoteIndex -lt 0) {
                break
            }

            $startIndex = $nextQuoteIndex + $quote.Length
            $telemetry.envQuottedBlocks++
            continue
        }

        $expansionPrefixIndex = $result.IndexOf($expansionPrefix, $startIndex)
        if ($expansionPrefixIndex -ge 0) {
            $expansionSuffixIndex = $result.IndexOf($expansionSuffix, $startIndex)
            if ($expansionSuffixIndex -lt 0) {
                $telemetry.unmatchedExpansionSyntax++;
                break;
            }

            $startIndex = $expansionSuffixIndex + $expansionSuffix.Length
            $telemetry.expansionSyntax++
            continue
        }

        $prefixIndex = $result.ToLower().IndexOf($envPrefix, $startIndex)
        if ($prefixIndex -lt 0) {
            $prefixIndex = $result.ToLower().IndexOf('${env:', $startIndex)
            if ($prefixIndex -lt 0) {
                break;
            }
            $telemetry.bracedEnvSyntax++
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

function Test-FileArgs([string]$inputArguments) {
    $featureFlags = @{
        audit     = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC_LOG)
        activate  = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC)
        telemetry = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_COLLECT)
    }

    ## get values of all keys
    Write-Debug "Feature flags state: @featureFlags"

    if ($featureFlags.activate -or $featureFlags.audit -or $featureFlags.telemetry) {
        Write-Debug "Validating file arguments."
        $expandedArgs, $expandTelemetry = Expand-EnvVariables $inputArguments;

        $sanitizedArgs, $sanitizerTelemetry = Sanitize-Arguments -InputArgs $expandedArgs;

        if ($sanitizedArgs -ne $input_arguments) {
            if ($featureFlags.telemetry -and (($null -ne $sanitizerTelemetry) -or ($null -ne $expandTelemetry))) {
                $telemetry = $expandTelemetry + $sanitizerTelemetry;
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
