[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationName = "app name"
$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$applicationType = @{
    ApplicationTypeName    = $ApplicationTypeName
    ApplicationTypeVersion = $ApplicationTypeVersion
    Status                 = [System.Fabric.Query.ApplicationTypeStatus]::Provisioning
}
$ApplicationParameter = @{}
$global:removeRetriesAttempted = 0
$global:getRetriesAttempted = 0
$global:forceRemoveRetriesAttempted = 0

Register-Mock Remove-ServiceFabricApplication {
    $global:removeRetriesAttempted++;

    if ($global:removeRetriesAttempted -eq 3)
    {
        throw [System.TimeoutException]::new()
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationName $ApplicationName -Force

Register-Mock Remove-ServiceFabricApplication {
    $global:forceRemoveRetriesAttempted++;

    if ($global:forceRemoveRetriesAttempted -eq 2)
    {
        return $null
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationName $ApplicationName -Force -ForceRemove

Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Remove-ServiceFabricApplicationAction -ApplicationName $ApplicationName
Assert-AreEqual 3 $global:removeRetriesAttempted "Number of remove retries not correct"
Assert-AreEqual 2 $global:forceRemoveRetriesAttempted "Number of force remove retries not correct"
