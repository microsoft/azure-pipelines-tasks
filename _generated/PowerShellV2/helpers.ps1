function Publish-Telemetry($telemetry) {
    $area = 'TaskHub'
    $feature = 'PowerShellV2'
    $telemetryJson = $telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}
