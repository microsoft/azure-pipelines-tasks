[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$applicationPackagePathInImageStore = "image path"
$TimeoutSec = 120
$applicationType = @{
    ApplicationTypeName    = $ApplicationTypeName
    ApplicationTypeVersion = $ApplicationTypeVersion
    Status                 = [System.Fabric.Query.ApplicationTypeStatus]::Available
}
$global:getRetriesAttempted = 0

Register-Mock Unregister-ServiceFabricApplicationType {
    return $true
} -- -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Force -Async -TimeoutSec $TimeoutSec

Register-Mock Get-ServiceFabricApplicationTypeAction {
    $global:getRetriesAttempted++

    if ($global:getRetriesAttempted -eq 3)
    {
        return
    }

    if ($global:getRetriesAttempted -eq 2)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning
        return $applicationType
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion

Register-Mock Get-SfSdkVersion { '3.1.183.9494' }
Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Force -TimeoutSec $TimeoutSec
Assert-AreEqual 3 $global:getRetriesAttempted "Number of unregister retries not correct"