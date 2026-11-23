[CmdletBinding()]
param()

# Regression test for the cluster and application health dumps written when an upgrade or registration fails.
# The cmdlets return objects whose health descriptions are provided by the cluster. Left in the success stream, the
# host would print them unfiltered, so a logging command in a description would reach the agent as a command.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$injection = '##vso[task.setvariable variable=INJECTED]x'

# Five properties, so that the host formats the object as a list and writes the whole description.
$health = [pscustomobject][ordered]@{
    AggregatedHealthState   = 'Error'
    NodeHealthStates        = 'None'
    ApplicationHealthStates = 'None'
    HealthEvents            = 'None'
    UnhealthyEvaluations    = "disk full`n$injection"
}

Register-Mock Get-ServiceFabricClusterHealth { $health }
Register-Mock Get-ServiceFabricApplicationHealth { $health } -- -ApplicationName 'fabric:/App'
Register-Mock Get-ServiceFabricApplicationHealth { throw 'Entity not found in Health Store.' } `
    -- -ApplicationName 'fabric:/Missing'
Register-HostCapture

. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act: anything the functions leave in the success stream is formatted by the host, so it is captured as output too.
$clusterOutput = @(Trace-ServiceFabricClusterHealth | Out-String -Stream)
$applicationOutput = @(Trace-ServiceFabricApplicationHealth -ApplicationName 'fabric:/App' | Out-String -Stream)
$global:LoggedHostLines += $clusterOutput + $applicationOutput

# Assert
Assert-NoLiveLoggingCommands
Assert-AuditEventWritten 'task.setvariable' -Count 2
Assert-LogLineWritten 'SFSDK_ClusterHealth'
Assert-LogLineWritten 'SFSDK_ApplicationHealth'
$dumps = @($global:LoggedHostLines | Where-Object {
    $_ -match 'AggregatedHealthState\s*:\s*Error' -and $_ -match '##_vso\[task\.setvariable variable=INJECTED\]x'
})
Assert-AreEqual 2 $dumps.Count `
    "Both health dumps must still be written, with the marker defused. $(Get-CapturedHostText)"

# An application that is not in the health store falls back to the cluster health.
Clear-HostCapture
Trace-ServiceFabricApplicationHealth -ApplicationName 'fabric:/Missing'
Assert-LogLineWritten 'SFSDK_ApplicationHealth'
Assert-LogLineWritten 'SFSDK_ClusterHealth'
