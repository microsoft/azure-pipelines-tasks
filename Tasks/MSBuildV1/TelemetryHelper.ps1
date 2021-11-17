function EmitTelemetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$TelemetryPayload)

    try {
        Assert-VstsAgent -Minimum '2.120.0'

        $telemetryJson = ConvertTo-Json $TelemetryPayload -Compress

        Write-Host "##vso[telemetry.publish area=TaskHub;feature=MSBuildV1]$telemetryJson"
    } catch {
        Write-Verbose "Failed to publish java telemetry: $errors"
    }
}
