function EmitTelemetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$TelemetryPayload,
        [Parameter(Mandatory = $true)]
        [string]$TaskName)

    try {
        Assert-VstsAgent -Minimum '2.120.0'

        $telemetryJson = ConvertTo-Json $TelemetryPayload -Compress

        Write-Host "##vso[telemetry.publish area=TaskHub;feature=$TaskName]$telemetryJson"
    } catch {
        Write-Verbose "Failed to publish java telemetry: $errors"
    }
}
