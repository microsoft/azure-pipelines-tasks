[CmdletBinding()]
param()

# Regression test for the message written when starting the application upgrade fails. The exception text
# comes from the cluster, so a logging command in it must never reach the agent as a command. The upgrade must
# still fail the task.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$applicationPackagePath = "$PSScriptRoot\data\ImageStoreTraversalAssets\BenignAppPkg"
$injection = '##vso[task.setvariable variable=INJECTED]x'

# The type is already registered and in use, so the upgrade starts without copying or registering the package.
$applicationType = [pscustomobject]@{ ApplicationTypeName = 'TestType'; ApplicationTypeVersion = '1.0.0' }
$global:UpgradeErrorUnderTest = $null

Register-Mock Get-ServiceFabricApplicationAction { $applicationType }
Register-Mock Test-ServiceFabricClusterConnectionAction
Register-Mock Get-ServiceFabricApplicationUpgradeAction {
    [pscustomobject]@{ UpgradeState = 'RollingForwardCompleted' }
}
Register-Mock Get-ServiceFabricApplicationTypeAction { $applicationType }
Register-Mock Start-ServiceFabricApplicationUpgradeAction { throw $global:UpgradeErrorUnderTest }
Register-Mock Copy-ServiceFabricApplicationPackageAction
Register-Mock Register-ServiceFabricApplicationTypeAction
Register-Mock Write-Warning
Register-HostCapture

. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Publish-UpgradedServiceFabricApplication.ps1

function Publish-FailingUpgrade
{
    Publish-UpgradedServiceFabricApplication `
        -ApplicationPackagePath $applicationPackagePath `
        -ApplicationName 'fabric:/AppName' `
        -Action 'RegisterAndUpgrade' `
        -SkipPackageValidation
}

# Act 1: an ordinary error message is written exactly as before and raises no audit event.
$global:UpgradeErrorUnderTest = 'upgrade rejected'
Assert-Throws { Publish-FailingUpgrade } -MessagePattern 'upgrade rejected'

Assert-AreEqual 2 $global:LoggedHostLines.Count `
    "Expected the upgrade start message and the upgrade failure message. $(Get-CapturedHostText)"
Assert-LogLineWritten 'SFSDK_StartAppUpgrade'
Assert-LogLineWritten 'SFSDK_StartUpgradeFailed upgrade rejected'
Assert-NoAuditEventWritten

# Act 2: a marker in the error message.
Clear-HostCapture
$global:UpgradeErrorUnderTest = "upgrade rejected`n$injection"
Assert-Throws { Publish-FailingUpgrade } -MessagePattern 'upgrade rejected*'

Assert-NoLiveLoggingCommands
Assert-AuditEventWritten 'task.setvariable' -Count 1
Assert-LogLineWritten "SFSDK_StartUpgradeFailed upgrade rejected`n##_vso[task.setvariable variable=INJECTED]x"
Assert-WasCalled Copy-ServiceFabricApplicationPackageAction -Times 0
Assert-WasCalled Register-ServiceFabricApplicationTypeAction -Times 0
