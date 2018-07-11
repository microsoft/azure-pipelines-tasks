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
    'ApplicationPathInImageStore' = $applicationPackagePathInImageStore
}
$getApplicationTypeParams = @{
    'ApplicationTypeName'    = $ApplicationTypeName;
    'ApplicationTypeVersion' = $ApplicationTypeVersion
}
$global:registerRetriesAttempted = 0
$global:getRetriesAttempted = 0
$global:clusterHealthPrinted = $false

Register-Mock Register-ServiceFabricApplicationType {
    $global:registerRetriesAttempted++
    $global:getRetriesAttempted = 0
    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- @RegisterParameters

Register-Mock Get-ServiceFabricApplicationType {
    $global:getRetriesAttempted++
    if ($global:getRetriesAttempted -eq 3)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Provisioning
        return $applicationType
    }

    if ($global:getRetriesAttempted -eq 2)
    {
        return $null
    }

    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- @getApplicationTypeParams

Register-Mock Get-ServiceFabricApplicationType {
    $global:waitRetriesAttempted++
    if ($global:waitRetriesAttempted -eq 4)
    {
        return $null
    }

    if ($global:waitRetriesAttempted -eq 2)
    {
        $applicationType.Status = [System.Fabric.Query.ApplicationTypeStatus]::Provisioning
        return $applicationType
    }

    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
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
    Register-ServiceFabricApplicationTypeAction -RegisterParameters $RegisterParameters -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
}
Assert-AreEqual 3 $global:registerRetriesAttempted "Number of register retries not correct"
Assert-AreEqual $true $global:clusterHealthPrinted "cluster health not printed in case of error"