function Publish-Telemetry($Telemetry) {
    $area = 'TaskHub'
    $feature = 'PowerShellV2'
    $telemetryJson = $Telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}

function Sanitize-FileArguments([string]$InputArgs) {

    $featureFlags = @{
        audit     = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_NEW_LOGIC_AUDIT)
        activate  = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_NEW_LOGIC)
        telemetry = [System.Convert]::ToBoolean($env:AZP_MSRC75787_ENABLE_TELEMETRY)
    }

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

        if ($featureFlags.audit || $featureFlags.activate) {
            Write-Warning (Get-VstsLocString -Key 'PS_FileArgsSanitized' -ArgumentList $resultArgs);
        }

        if ($featureFlags.telemetry) {
            $removedSymbolsCount = [regex]::matches($resultArgs, $removedSymbolSign).count
            Publish-Telemetry @{ 'removedSymbolsCount' = $removedSymbolsCount }
        }
    }

    return $resultArgs;
}
