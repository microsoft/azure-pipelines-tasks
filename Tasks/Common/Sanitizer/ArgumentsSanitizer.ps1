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
    } else {
        Write-Host (Get-VstsLocString -Key 'PS_ScriptArgsSanitized' -ArgumentList $sanitizedArguments);
    }

    return $sanitizedArguments -split ' '
}

function Get-SanitizedArguments([string]$inputArgs) {

    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $inputArgs -split $argsSplitSymbols;

    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        ## '?<!`' - checking if before character no backtick. '([allowedchars])' - checking if character is allowed. Otherwise, replace to $removedSymbolSign
        $argsArr[$i] = $argsArr[$i] -replace '(?<!\\)([^a-zA-Z0-9\\ _''"\-=/:.])', $removedSymbolSign;
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    if ( $resultArgs -like "*$removedSymbolSign*" -and $featureFlags.telemetry) {
        $removedSymbolsCount = [regex]::matches($resultArgs, $removedSymbolSign).count
        Publish-Telemetry @{ 'removedSymbolsCount' = $removedSymbolsCount }
    }

    return $resultArgs;
}

function Publish-Telemetry($telemetry) {
    $area = 'TaskHub'
    $feature = $script:taskName
    $telemetryJson = $telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}