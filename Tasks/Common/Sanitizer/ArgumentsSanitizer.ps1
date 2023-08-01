$featureFlags = @{
    telemetry = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_COLLECT)
}

Write-Verbose "Feature flag AZP_75787_ENABLE_COLLECT state: $($featureFlags.telemetry)"

$taskName = ""

# The only public function, which should be called from the task
# This is a wrapper for Get-SanitizedArguments to handle feature flags in one place
# It will return sanitized arguments string if feature flag is enabled
function Protect-ScriptArguments([string]$inputArgs, [string]$taskName) {
    $script:taskName = $taskName

    $sanitizedArguments = Get-SanitizedArguments -InputArgs $inputArgs

    if ($sanitizedArguments -eq $inputArgs) {
        Write-Host (Get-VstsLocString -Key 'PS_ScriptArgsNotSanitized');
    }
    else {
        Write-Host (Get-VstsLocString -Key 'PS_ScriptArgsSanitized' -ArgumentList $sanitizedArguments);
    }

    $arrayOfArguments = Split-Arguments -Arguments $sanitizedArguments
    return $arrayOfArguments
}

function Get-SanitizedArguments([string]$inputArgs) {

    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';
    [string[][]]$matchesChunks = @()

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $inputArgs -split $argsSplitSymbols;
    $regex = '(?<!\\)([^a-zA-Z0-9\\ _''"\-=/:.])';
    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        ## We're adding matched values from splitted chunk for telemetry.
        $argsArr[$i] -match $regex;
        $matchesChunks += , $Matches.Values;

        ## '?<!`' - checking if before character no backtick. '([allowedchars])' - checking if character is allowed. Otherwise, replace to $removedSymbolSign
        $argsArr[$i] = $argsArr[$i] -replace $regex, $removedSymbolSign;
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    if ( $resultArgs -ne $inputArgs -and $featureFlags.telemetry) {
        $argMatches = $matchesChunks | ForEach-Object { $_ } | Where-Object { $_ -ne $null }
        $telemetry = @{
            removedSymbols      = Join-Matches -Matches $argMatches
            removedSymbolsCount = $argMatches.Count
        }

        Publish-Telemetry $telemetry
    }

    return $resultArgs;
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
