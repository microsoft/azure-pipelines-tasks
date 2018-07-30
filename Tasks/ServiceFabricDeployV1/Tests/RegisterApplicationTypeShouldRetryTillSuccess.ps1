[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$applicationPackagePathInImageStore = "image path"
$applicationType = @{
    ApplicationTypeName    = $ApplicationTypeName
    ApplicationTypeVersion = $ApplicationTypeVersion
    Status                 = [System.Fabric.Query.ApplicationTypeStatus]::Provisioning
}
$RegisterParameters = @{
    'ApplicationPathInImageStore' = $applicationPackagePathInImageStore;
    'Async' = $true
}
$global:getRetriesAttempted = 0

Register-Mock Register-ServiceFabricApplicationType {
    return $true;
} -- @RegisterParameters

Register-Mock Get-ServiceFabricApplicationTypeAction {
    $global:getRetriesAttempted++;
    if ($global:getRetriesAttempted -eq 3)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Available
        return $applicationType
    }
    throw [System.Fabric.FabricTransientException]::new("Could not ping!!")
} -- -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion

Register-Mock Get-SfSdkVersion { '3.1.183.9494' }
Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Register-ServiceFabricApplicationTypeAction -RegisterParameters $RegisterParameters -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
Assert-AreEqual 3 $global:getRetriesAttempted "Number of register retries not correct"
