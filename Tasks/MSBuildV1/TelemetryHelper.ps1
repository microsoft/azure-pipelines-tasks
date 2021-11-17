function EmitTelemetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$TelemetryPayload)

    try {
        Assert-VstsAgent -Minimum '2.120.0'
        # $jsonString = -join("{")
        # $jsonString = -join( $jsonString,
        #     "`"MSBuildVersion`" : `"$TelemetryPayload.MSBuildVersion`"" ,
        #     ",")
        # $jsonString = -join( $jsonString,
        #     "`"MSBuildArchitecture`" : `"$TelemetryPayload.MSBuildArguments`"",
        #     ",")
        # $jsonString = -join( $jsonString,
        #     "`"MSBuildArguments`" : `"$TelemetryPayload.MSBuildLocation`"",
        #     ",")
        # $jsonString = -join( $jsonString,
        #     "`"MSBuildLocation`" : `"$msBuildLocation.MSBuildLocationMethod`"",
        #     ",")
        # $jsonString = -join( $jsonString,
        #     "`"Platform`" : `"$TelemetryPayload.Platform`"",
        #     ",")
        # $jsonString = -join( $jsonString,
        #     "`"Configuration`" : `"$TelemetryPayload.Configuration`"",
        #     ",")
        # $jsonString = -join( $jsonString,
        #     "`"msbuildExectionTimeSeconds`" : `"$TelemetryPayload.MSBuildExectionTimeSeconds`"",
        #     ",")
        # $jsonString = -join($jsonString, "}")

        $telemetryJson = ConvertTo-Json $TelemetryPayload -Compress

        Write-Host "##vso[telemetry.publish area=TaskHub;feature=MSBuildV1]$telemetryJson"
    } catch {
        Write-Verbose "Failed to publish java telemetry: $errors"
    }
}
