$featureFlags = @{
    activate  = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_NEW_LOGIC ?? $false)
    telemetry = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_TELEMETRY ?? $false)
}

Write-Verbose "Feature flag AZP_MSRC75787_ENABLE_NEW_LOGIC state: $($featureFlags.activate)"
Write-Verbose "Feature flag AZP_MSRC75787_ENABLE_TELEMETRY state: $($featureFlags.telemetry)"

$taskName = ""

# The only public function, which should be called from the task
# This is a wrapper for Get-SanitizedArguments to handle feature flags in one place
# It will return sanitized arguments string if feature flag is enabled
function Protect-ScriptArguments([string]$inputArgs, [string]$taskName) {
    $script:taskName = $taskName

    if ($featureFlags.activate) {
        $sanitizedArguments = Get-SanitizedArguments -InputArgs $inputArgs
        return $sanitizedArguments -split ' '
    }
    
    return $inputArgs -split ' '
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

    if ( $resultArgs -like "*$removedSymbolSign*") {
        Write-Output (Get-VstsLocString -Key 'PS_ScriptArgsSanitized' -ArgumentList $resultArgs);

        if ($featureFlags.telemetry) {
            $removedSymbolsCount = [regex]::matches($resultArgs, $removedSymbolSign).count
            Publish-Telemetry @{ 'removedSymbolsCount' = $removedSymbolsCount }
        }
    }
    else {
        Write-Output (Get-VstsLocString -Key 'PS_ScriptArgsNotSanitized');
    }

    return $resultArgs;
}

function Publish-Telemetry($telemetry) {
    $area = 'TaskHub'
    $feature = $script:taskName
    $telemetryJson = $telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}