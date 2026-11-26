[CmdletBinding()]
param()

# Negative control for PublishNewRejectsTraversalInApplicationTypeName.ps1:
# identical setup but with a BENIGN ApplicationTypeName. Must NOT throw, and must reach the image
# store copy/register calls. Proves the traversal test fails for the right reason and that the new
# validation does not break legitimate publishes.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$applicationPackagePath = "$PSScriptRoot\data\ImageStoreTraversalAssets\BenignAppPkg"
$applicationName = "fabric:/AppName"

Register-Mock Test-ServiceFabricClusterConnectionAction
Register-Mock Get-ServiceFabricApplicationAction
Register-Mock Get-ServiceFabricApplicationTypeAction
Register-Mock Get-ServiceFabricClusterManifestAction { "<ClusterManifest></ClusterManifest>" }
Register-Mock Get-ItemProperty { @{ "FabricSDKVersion" = "3.0" } } -- -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKVersion
Register-Mock Copy-ServiceFabricApplicationPackageAction
Register-Mock Register-ServiceFabricApplicationTypeAction
Register-Mock Remove-ServiceFabricApplicationPackageAction
Register-Mock New-ServiceFabricApplicationAction
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Publish-NewServiceFabricApplication.ps1

Publish-NewServiceFabricApplication `
    -ApplicationPackagePath $applicationPackagePath `
    -ApplicationName $applicationName `
    -Action 'RegisterAndCreate' `
    -OverwriteBehavior 'Always' `
    -SkipPackageValidation

# Assert: a legitimate application type name still flows all the way through to the image store.
Assert-WasCalled Copy-ServiceFabricApplicationPackageAction
Assert-WasCalled Register-ServiceFabricApplicationTypeAction
Assert-WasCalled New-ServiceFabricApplicationAction
