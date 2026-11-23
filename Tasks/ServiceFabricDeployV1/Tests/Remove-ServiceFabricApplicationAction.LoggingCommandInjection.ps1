[CmdletBinding()]
param()

# Regression test for the message written when removing an application times out and the removal is repeated as a
# forced removal. The application name is read back from the cluster and passed as a URI. A logging command in it must
# never reach the agent as a command, and the application must still be force removed.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$injection = '##vso[task.setvariable variable=INJECTED]x'
$defusedInjection = '##_vso[task.setvariable variable=INJECTED]x'

$global:RemoveCalls = @()
Register-Mock Remove-ServiceFabricApplication {
    param([string]$ApplicationName, [switch]$Force, [switch]$ForceRemove)

    $global:RemoveCalls += ,@{ ApplicationName = $ApplicationName; ForceRemove = [bool]$ForceRemove }
    if (-not $ForceRemove)
    {
        throw [System.TimeoutException]::new('The operation timed out.')
    }
}
# The retry loops are not under test, and they only accept exception types that exist once the Service Fabric SDK is
# loaded.
Register-Mock Invoke-ActionWithDefaultRetries { param([scriptblock]$Action) & $Action }
Register-HostCapture

. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act 1: an ordinary name is written exactly as before and raises no audit event.
Remove-ServiceFabricApplicationAction -ApplicationName ([uri]'fabric:/AppName')

Assert-LogLineWritten 'SFSDK_PerformingForceRemoveOnTimeout fabric:/AppName'
Assert-NoAuditEventWritten

# Act 2: a marker in the name.
Clear-HostCapture
$global:RemoveCalls = @()
Remove-ServiceFabricApplicationAction -ApplicationName ([uri]"fabric:/AppName%0A$injection")

Assert-NoLiveLoggingCommands
Assert-AuditEventWritten 'task.setvariable' -Count 1
$message = @($global:LoggedHostLines | Where-Object { $_ -like 'SFSDK_PerformingForceRemoveOnTimeout *' })
Assert-AreEqual 1 $message.Count "The force remove message must still be written. $(Get-CapturedHostText)"
Assert-AreEqual $true $message[0].EndsWith($defusedInjection) `
    "The marker must be defused, not removed. $(Get-CapturedHostText)"

# The message only reports the retry: the application is still removed, first normally and then forced.
Assert-AreEqual 2 $global:RemoveCalls.Count "Expected a removal and a forced removal."
Assert-AreEqual $false $global:RemoveCalls[0].ForceRemove "The first removal must not be forced."
Assert-AreEqual $true $global:RemoveCalls[1].ForceRemove "The second removal must be forced."
