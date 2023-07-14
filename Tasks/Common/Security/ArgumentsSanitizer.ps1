$featureFlags = @{
    audit     = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_NEW_LOGIC_AUDIT)
    activate  = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_NEW_LOGIC)
    telemetry = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_TELEMETRY)
}

Write-Debug "Feature flag AZP_MSRC75787_ENABLE_NEW_LOGIC_AUDIT state: $($featureFlags.audit)"
Write-Debug "Feature flag AZP_MSRC75787_ENABLE_NEW_LOGIC state: $($featureFlags.activate)"
Write-Debug "Feature flag AZP_MSRC75787_ENABLE_TELEMETRY state: $($featureFlags.telemetry)"

# The only public function, which should be called from the task
# This is a wrapper for Get-SanitizedArgumentsArray to handle feature flags in one place
# It will return sanitized arguments if feature flags are enabled
function Sanitize-ScriptArguments([string]$InputArgs) {

    if ($featureFlags.audit || $featureFlags.activate) {

        $sanitizedArguments = Get-SanitizedArgumentsArray -InputArgs $InputArgs
        return $sanitizedArguments
    }
    
    return $InputArgs
}

function Get-SanitizedArgumentsArray([string]$InputArgs) {

    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $InputArgs -split $argsSplitSymbols;

    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        ## '?<!`' - checking if before character no backtick. '^a-zA-Z0-9` _'"-' - checking if character is allowed. Insead replacing to #removed#
        $argsArr[$i] = $argsArr[$i] -replace '(?<!\\)([^a-zA-Z0-9\\ _''"\-=])', $removedSymbolSign;
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    if ( $resultArgs -like "*$removedSymbolSign*") {

        Write-Warning (Get-VstsLocString -Key 'PS_FileArgsSanitized' -ArgumentList $resultArgs);

        if ($featureFlags.telemetry) {
            $removedSymbolsCount = [regex]::matches($resultArgs, $removedSymbolSign).count
            Publish-Telemetry @{ 'removedSymbolsCount' = $removedSymbolsCount }
        }
    }

    return $resultArgs -split ' ';
}

function Publish-Telemetry($Telemetry) {
    $area = 'TaskHub'
    $feature = 'PowerShellV2' # TODO: Clarify the feature name
    $telemetryJson = $Telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}