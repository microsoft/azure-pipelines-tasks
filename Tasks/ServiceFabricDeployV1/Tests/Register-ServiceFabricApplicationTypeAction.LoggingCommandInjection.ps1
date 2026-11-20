[CmdletBinding()]
param()

# Regression test for the registration of an application type. After registering it, the action waits until the
# cluster reports the type as available. The type the cluster returns carries text that the cluster provides. It must
# never reach the agent as a command: the host would print it unfiltered if the action left it in the success stream.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$injection = '##vso[task.setvariable variable=INJECTED]x'

# Five properties, so that the host formats the object as a list and writes the whole description.
$global:RegisteredTypeUnderTest = [pscustomobject][ordered]@{
    ApplicationTypeName    = "AppType$injection"
    ApplicationTypeVersion = '1.0'
    Status                 = 'Available'
    StatusDetails          = "registered`n$injection"
    DefaultParameters      = 'None'
}

Register-Mock Get-SfSdkVersion { '3.1.183.9494' }
# The retry loops are not under test, and they only accept exception types that exist once the Service Fabric SDK is
# loaded.
Register-Mock Invoke-ActionWithDefaultRetries
Register-Mock Wait-ServiceFabricApplicationTypeRegistrationStatus { $global:RegisteredTypeUnderTest }
Register-HostCapture

. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act: anything the action leaves in the success stream is formatted by the host, so it is captured as output too.
$output = @(Register-ServiceFabricApplicationTypeAction `
    -RegisterParameters @{ 'ApplicationPathInImageStore' = 'image path' } `
    -ApplicationTypeName 'AppType' `
    -ApplicationTypeVersion '1.0' `
    -TimeoutSec 60 | Out-String -Stream)
$global:LoggedHostLines += $output

# Assert: the text of the type must not reach the agent as a command, whether it is left in the success stream or
# written to the host. Unlike Assert-NoLiveLoggingCommands this does not insist on output: the action may log nothing.
$live = @($global:LoggedHostLines | Where-Object { $_ -match '##vso\[' -or $_ -match '##\[' })
Assert-AreEqual 0 $live.Count "Output still contains a live logging-command marker: $($live -join ' | ')"
Assert-WasCalled Wait-ServiceFabricApplicationTypeRegistrationStatus -Times 1
