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
$RegisterParameters = @{
    'ApplicationPathInImageStore' = $applicationPackagePathInImageStore
}
$getApplicationTypeParams = @{
    'ApplicationTypeName'    = $ApplicationTypeName;
    'ApplicationTypeVersion' = $ApplicationTypeVersion
}
$global:unregisterRetriesAttempted = 0
$global:getRetriesAttempted = 0
$global:clusterHealthPrinted = $false

Register-Mock Unregister-ServiceFabricApplicationType {
    $global:unregisterRetriesAttempted++
    $global:getRetriesAttempted = 0
    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Force -TimeoutSec $TimeoutSec

Register-Mock Get-ServiceFabricApplicationType {
    $global:getRetriesAttempted++
    if ($global:getRetriesAttempted -eq 3)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning
        return $applicationType
    }

    if ($global:getRetriesAttempted -eq 2)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Available
        return $applicationType
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- @getApplicationTypeParams

Register-Mock Get-ServiceFabricApplicationType {
    $global:waitRetriesAttempted++
    if ($global:waitRetriesAttempted -eq 4)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Failed
        return $applicationType
    }

    if ($global:waitRetriesAttempted -eq 2)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning
        return $applicationType
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion

Register-Mock Get-ServiceFabricClusterHealth {
    $global:clusterHealthPrinted = $true
}

Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Assert-Throws {
    Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Force -TimeoutSec $TimeoutSec
}
Assert-AreEqual 3 $global:unregisterRetriesAttempted "Number of unregister retries not correct"
Assert-AreEqual $true $global:clusterHealthPrinted "cluster health not printed in case of error"