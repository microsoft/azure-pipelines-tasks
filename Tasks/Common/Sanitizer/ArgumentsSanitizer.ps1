. $PSScriptRoot\Expand-EnvVariables.ps1

$featureFlags = @{
    activate  = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC)
    audit     = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC_LOG)
    telemetry = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_COLLECT)
}

Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC state: $($featureFlags.activate)"
Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC_LOG state: $($featureFlags.audit)"
Write-Verbose "Feature flag AZP_75787_ENABLE_COLLECT state: $($featureFlags.telemetry)"

$taskName = ""

# public functions - start

function Get-SanitizerFeatureFlags {
    return $featureFlags
}

function Get-SanitizerCallStatus {
    return $featureFlags.activate -or $featureFlags.audit -or $featureFlags.telemetry
}

function Get-SanitizerActivateStatus {
    $activateFlag = $featureFlags.activate
    Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC state: $activateFlag"
    return $activateFlag
}

# This is a wrapper for Get-SanitizedArguments to handle feature flags in one place
# It will return sanitized arguments string if feature flag is enabled
function Protect-ScriptArguments([string]$inputArgs, [string]$taskName) {
    $script:taskName = $taskName

    $expandedArgs, $expandTelemetry = Expand-EnvVariables $inputArgs;

    $sanitizedArgs, $sanitizeTelemetry = Get-SanitizedArguments -InputArgs $expandedArgs

    if ($sanitizedArgs -eq $inputArgs) {
        Write-Debug 'Arguments passed sanitization without change.'
    }
    else {
        if ($featureFlags.telemetry) {
            $telemetry = $expandTelemetry;
            if ($null -ne $sanitizeTelemetry) {
                $telemetry += $sanitizeTelemetry;
            }
            Publish-Telemetry $telemetry;
        }

        if ($sanitizedArgs -ne $expandedArgs) {
            $message = (Get-VstsLocString -Key 'PS_ScriptArgsSanitized');

            if ($featureFlags.activate) {
                Write-Error $message
                throw $message
            }
            elseif ($featureFlags.audit) {
                Write-VstsTaskWarning -Message $message -AuditAction 1
            }
        }
    }

    $arrayOfArguments = Split-Arguments -Arguments $sanitizedArgs
    return $arrayOfArguments
}

# public functions - end

# !ATTENTION: don't write any console output in this method, because it will break result
function Get-SanitizedArguments([string]$inputArgs) {
    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';
    [string[][]]$matchesChunks = @()

    ## PowerShell Regex is case insensitive by default, so we don't need to specify a-zA-Z.
    ## ('?<!`') - checking if before character no backtick.
    ## ([^\w` _'"-=\/:\.*,+~?%\n#]) - checking if character is allowed. Insead replacing to #removed#
    ## (?!true|false) - checking if after characters sequence no $true or $false.
    $regex = '(?<!`)([^\w\\` _''"\-=\/:\.*,+~?%\n#])(?!true|false)'

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $inputArgs -split $argsSplitSymbols;

    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        [string[]]$matches = (Select-String $regex -input $argsArr[$i] -AllMatches) | ForEach-Object { $_.Matches }
        if ($null -ne $matches ) {
            $matchesChunks += , $matches;
            $argsArr[$i] = $argsArr[$i] -replace $regex, $removedSymbolSign;
        }
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    $telemetry = $null
    if ( $resultArgs -ne $inputArgs) {
        $argMatches = $matchesChunks | ForEach-Object { $_ } | Where-Object { $_ -ne $null }
        $telemetry = @{
            removedSymbols      = Join-Matches -Matches $argMatches
            removedSymbolsCount = $argMatches.Count
        }
    }

    return $($resultArgs, $telemetry);
}

function Publish-Telemetry($telemetry) {
    $area = 'TaskHub'
    $feature = $script:taskName
    $telemetryJson = $telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}

# Splits a string into array of arguments, considering quotes.
function Split-Arguments {
    [OutputType([String[]])]
    param(
        [string]$arguments
    )

    # If the incoming arguments string is null or empty or space, return an empty array
    if ([string]::IsNullOrWhiteSpace($arguments)) {
        return New-Object string[] 0
    }

    # Use regular expression to match all possible formats of arguments:
    # 1) "arg" (enclosed in double quotes)
    # 2) 'arg' (enclosed in single quotes)
    # 3) arg (not enclosed in quotes)
    # Each match found by the regular expression will have several groups.
    # Group[0] is the whole match, Group[1] is the match for "arg", Group[2] is the match for 'arg'.
    $matchesList = [System.Text.RegularExpressions.Regex]::Matches($arguments, "`"([^`"]*)`"|'([^']*)'|[^ ]+")

    $result = @()

    foreach ($match in $matchesList) {
        # Attempt to get the argument from Group[1] (for "arg").
        $arg = $match.Groups[1].Value

        # If Group[1] didn't have a match (was not "arg" format), try Group[2] (for 'arg').
        if ([string]::IsNullOrEmpty($arg)) {
            $arg = $match.Groups[2].Value
        }

        # If neither Group[1] nor Group[2] had a match (was not enclosed in quotes), use the whole match (Group[0]).
        if ([string]::IsNullOrEmpty($arg)) {
            $arg = $match.Groups[0].Value
        }

        # Add the extracted argument to the result array.
        $result += $arg
    }

    return $result
}

function Join-Matches {
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
