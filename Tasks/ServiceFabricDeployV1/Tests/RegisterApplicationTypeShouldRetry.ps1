[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$applicationPackagePathInImageStore = "image path"
$RegisterParameters = @{
    'ApplicationPathInImageStore' = $applicationPackagePathInImageStore;
    'Async' = $true
}
$waitApplicationTypeParams = @{
    'ApplicationTypeName'    = $ApplicationTypeName;
    'ApplicationTypeVersion' = $ApplicationTypeVersion
}
$global:registerRetriesAttempted = 0

Register-Mock Register-ServiceFabricApplicationType {
    $global:registerRetriesAttempted++
    if ($global:registerRetriesAttempted -eq 3)
    {
        throw [System.Fabric.FabricElementAlreadyExistsException]::new("AppType already exists")
    }
    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- @RegisterParameters

Register-Mock Wait-ServiceFabricApplicationTypeRegistrationStatus {
    return
} -- @waitApplicationTypeParams

Register-Mock Get-SfSdkVersion { '3.1.183.9494' }
Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Register-ServiceFabricApplicationTypeAction -RegisterParameters $RegisterParameters -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
Assert-AreEqual 3 $global:registerRetriesAttempted "Number of register retries not correct"