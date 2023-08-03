function Publish-Telemetry($Telemetry) {
    $area = 'TaskHub'
    $feature = 'PowerShellV2'
    $telemetryJson = $Telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}

function Combine-Matches {
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
            removedSymbols      = Combine-Matches -Matches $argMatches
            removedSymbolsCount = $argMatches.Count
        }
    }

    return , $resultArgs, $telemetry;
}
