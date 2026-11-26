[CmdletBinding()]
param()

# Security regression test for the image store path traversal in the Service Fabric SDK publish
# scripts.
#
# ApplicationTypeName is read out of the local ApplicationManifest.xml and used as the application
# package path inside the cluster image store. It used to be passed through unvalidated, so a name
# containing '..', a path separator or an absolute/UNC path pointed the copy, register and remove
# image store operations at a location outside the folder the package belongs to. With a file share
# backed image store that is a real file write, and the remove operation is a real delete.
#
# The publish call must now fail closed before anything is copied to the image store, and - because
# OverwriteBehavior 'Always' removes the existing application earlier in the function - before the
# cluster is modified at all.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$applicationPackagePath = "$PSScriptRoot\data\ImageStoreTraversalAssets\AppPkg"
$applicationName = "fabric:/AppName"

Register-Mock Test-ServiceFabricClusterConnectionAction
Register-Mock Get-ServiceFabricApplicationAction
Register-Mock Get-ServiceFabricApplicationTypeAction
Register-Mock Get-ServiceFabricClusterManifestAction
Register-Mock Remove-ServiceFabricApplicationAction
Register-Mock Unregister-ServiceFabricApplicationTypeAction
Register-Mock Copy-ServiceFabricApplicationPackageAction
Register-Mock Register-ServiceFabricApplicationTypeAction
Register-Mock Remove-ServiceFabricApplicationPackageAction
Register-Mock New-ServiceFabricApplicationAction
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Publish-NewServiceFabricApplication.ps1

# Act/Assert
Assert-Throws {
    Publish-NewServiceFabricApplication `
        -ApplicationPackagePath $applicationPackagePath `
        -ApplicationName $applicationName `
        -Action 'RegisterAndCreate' `
        -OverwriteBehavior 'Always' `
        -SkipPackageValidation
} -MessagePattern "*ApplicationTypeName*"

# Nothing may reach the image store, and the cluster must not have been modified. The existing
# application removal that OverwriteBehavior 'Always' would otherwise perform must not have run.
Assert-WasCalled Copy-ServiceFabricApplicationPackageAction -Times 0
Assert-WasCalled Register-ServiceFabricApplicationTypeAction -Times 0
Assert-WasCalled Remove-ServiceFabricApplicationPackageAction -Times 0
Assert-WasCalled Remove-ServiceFabricApplicationAction -Times 0
Assert-WasCalled New-ServiceFabricApplicationAction -Times 0
