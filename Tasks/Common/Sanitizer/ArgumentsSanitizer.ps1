$featureFlags = @{
    activate  = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_NEW_LOGIC)
    telemetry = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_TELEMETRY)
}

Write-Verbose "Feature flag AZP_MSRC75787_ENABLE_NEW_LOGIC state: $($featureFlags.activate)"
Write-Verbose "Feature flag AZP_MSRC75787_ENABLE_TELEMETRY state: $($featureFlags.telemetry)"

# The only public function, which should be called from the task
# This is a wrapper for Get-SanitizedArguments to handle feature flags in one place
# It will return sanitized arguments string if feature flag is enabled
function Protect-ScriptArguments([string]$InputArgs) {

    if ($featureFlags.activate) {

        $sanitizedArguments = Get-SanitizedArguments -InputArgs $InputArgs
        return $sanitizedArguments -split ' '
    }
    
    return $InputArgs -split ' '
}

function Get-SanitizedArguments([string]$InputArgs) {

    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $InputArgs -split $argsSplitSymbols;

    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        ## '?<!`' - checking if before character no backtick. '([allowedchars])' - checking if character is allowed. Otherwise, replace to $removedSymbolSign
        $argsArr[$i] = $argsArr[$i] -replace '(?<!\\)([^a-zA-Z0-9\\ _''"\-=/:.])', $removedSymbolSign;
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    if ( $resultArgs -like "*$removedSymbolSign*") {

        Write-Output (Get-VstsLocString -Key 'PS_ScriptArgsSanitized' -ArgumentList $resultArgs);

        if ($featureFlags.telemetry) {
            $removedSymbolsCount = [regex]::matches($resultArgs, $removedSymbolSign).count
            Publish-Telemetry @{ 'removedSymbolsCount' = $removedSymbolsCount }
        }
    }

    return $resultArgs;
}

function Publish-Telemetry($Telemetry) {
    $area = 'TaskHub'
    $feature = 'PowerShellV2' # TODO: Clarify the feature name
    $telemetryJson = $Telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}