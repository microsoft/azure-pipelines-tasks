[CmdletBinding()]
param()

# Regression test for the message written before an existing application is removed under OverwriteBehavior
# 'Always'. The values are read back from the cluster, so a logging command in them must never reach the agent as a
# command. The publish must still remove the application and create the new one.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$applicationPackagePath = "$PSScriptRoot\data\ImageStoreTraversalAssets\BenignAppPkg"
$injection = '##vso[task.setvariable variable=INJECTED]x'
$defusedInjection = '##_vso[task.setvariable variable=INJECTED]x'

$global:ExistingApplicationUnderTest = $null

Register-Mock Test-ServiceFabricClusterConnectionAction
Register-Mock Get-ServiceFabricApplicationAction { $global:ExistingApplicationUnderTest }
Register-Mock Remove-ServiceFabricApplicationAction
Register-Mock Unregister-ServiceFabricApplicationTypeAction
Register-Mock Get-ServiceFabricApplicationTypeAction
Register-Mock Get-ServiceFabricClusterManifestAction { "<ClusterManifest></ClusterManifest>" }
Register-Mock Get-ItemProperty { @{ "FabricSDKVersion" = "3.0" } } `
    -- -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKVersion
Register-Mock Copy-ServiceFabricApplicationPackageAction
Register-Mock Register-ServiceFabricApplicationTypeAction
Register-Mock Remove-ServiceFabricApplicationPackageAction
Register-Mock New-ServiceFabricApplicationAction
Register-Mock Write-VstsTaskError
Register-HostCapture

. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Publish-NewServiceFabricApplication.ps1

function Publish-OverwritingExistingApplication
{
    Publish-NewServiceFabricApplication `
        -ApplicationPackagePath $applicationPackagePath `
        -ApplicationName 'fabric:/AppName' `
        -Action 'RegisterAndCreate' `
        -OverwriteBehavior 'Always' `
        -SkipPackageValidation
}

function New-ExistingApplication
{
    param([string]$TypeName, [string]$TypeVersion)

    [pscustomobject]@{
        ApplicationName        = 'fabric:/AppName'
        ApplicationTypeName    = $TypeName
        ApplicationTypeVersion = $TypeVersion
    }
}

# Act 1: ordinary values are written exactly as before and raise no audit event.
$global:ExistingApplicationUnderTest = New-ExistingApplication -TypeName 'OtherType' -TypeVersion '9.9'
Publish-OverwritingExistingApplication

Assert-LogLineWritten 'SFSDK_AppAlreadyExistsInfo fabric:/AppName OtherType 9.9'
Assert-NoAuditEventWritten

# Act 2: a marker in the type name and one in the version, each raising its own audit event.
Clear-HostCapture
$global:ExistingApplicationUnderTest = New-ExistingApplication `
    -TypeName "OtherType$injection" -TypeVersion "9.9 $injection"
Publish-OverwritingExistingApplication

Assert-NoLiveLoggingCommands
Assert-AuditEventWritten 'task.setvariable' -Count 2
Assert-LogLineWritten "SFSDK_AppAlreadyExistsInfo fabric:/AppName OtherType$defusedInjection 9.9 $defusedInjection"

# The message only reports the overwrite: the existing application is still removed and the new one created.
Assert-WasCalled Remove-ServiceFabricApplicationAction -Times 2
Assert-WasCalled New-ServiceFabricApplicationAction -Times 2
