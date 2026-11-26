[CmdletBinding()]
param()

# Security regression test for the image store path traversal in the Service Fabric SDK publish
# scripts - upgrade flow. Mirrors PublishNewRejectsTraversalInApplicationTypeName.ps1, but exercises
# Publish-UpgradedServiceFabricApplication instead of Publish-NewServiceFabricApplication.
#
# ApplicationTypeName is read out of the local ApplicationManifest.xml and used as the application
# package path inside the cluster image store. It used to be passed through unvalidated, so a name
# containing '..', a path separator or an absolute/UNC path pointed the copy, register and remove
# image store operations at a location outside the folder the package belongs to. With a file share
# backed image store that is a real file write, and the remove operation is a real delete.
#
# The upgrade call must now fail closed before anything is copied to the image store, and - because
# the check runs immediately after the manifest is read - before the cluster is queried or modified
# at all: the existing-application lookup, the cluster-connection check, and the upgrade status
# check must never run.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$applicationPackagePath = "$PSScriptRoot\data\ImageStoreTraversalAssets\AppPkg"
$applicationName = "fabric:/AppName"

Register-Mock Get-ServiceFabricApplicationAction
Register-Mock Test-ServiceFabricClusterConnectionAction
Register-Mock Get-ServiceFabricApplicationUpgradeAction
Register-Mock Get-ServiceFabricApplicationTypeAction
Register-Mock Get-ServiceFabricClusterManifestAction
Register-Mock Unregister-ServiceFabricApplicationTypeAction
Register-Mock Copy-ServiceFabricApplicationPackageAction
Register-Mock Register-ServiceFabricApplicationTypeAction
Register-Mock Remove-ServiceFabricApplicationPackageAction
Register-Mock Start-ServiceFabricApplicationUpgradeAction
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Publish-UpgradedServiceFabricApplication.ps1

# Act/Assert
Assert-Throws {
    Publish-UpgradedServiceFabricApplication `
        -ApplicationPackagePath $applicationPackagePath `
        -ApplicationName $applicationName `
        -Action 'RegisterAndUpgrade' `
        -SkipPackageValidation
} -MessagePattern "*ApplicationTypeName*"

# Nothing may reach the image store, and the cluster must not have been queried or modified. The
# existing-application lookup and cluster-connection check that would normally run before the
# upgrade must not have been reached either.
Assert-WasCalled Get-ServiceFabricApplicationAction -Times 0
Assert-WasCalled Test-ServiceFabricClusterConnectionAction -Times 0
Assert-WasCalled Get-ServiceFabricApplicationUpgradeAction -Times 0
Assert-WasCalled Copy-ServiceFabricApplicationPackageAction -Times 0
Assert-WasCalled Register-ServiceFabricApplicationTypeAction -Times 0
Assert-WasCalled Remove-ServiceFabricApplicationPackageAction -Times 0
Assert-WasCalled Start-ServiceFabricApplicationUpgradeAction -Times 0
