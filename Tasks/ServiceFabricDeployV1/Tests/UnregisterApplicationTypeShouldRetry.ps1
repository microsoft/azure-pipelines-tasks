[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$TimeoutSec = 120
$getApplicationTypeParams = @{
    'ApplicationTypeName'    = $ApplicationTypeName;
    'ApplicationTypeVersion' = $ApplicationTypeVersion
    'UsePaging' = $true
}
$global:getRetriesAttempted = 0

Register-Mock Unregister-ServiceFabricApplicationType {
    $global:getRetriesAttempted = 0
    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Async -Force -TimeoutSec $TimeoutSec

Register-Mock Get-ServiceFabricApplicationType {
    $global:getRetriesAttempted++

    if ($global:getRetriesAttempted -eq 2)
    {
        return
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- @getApplicationTypeParams

Register-Mock Get-SfSdkVersion { '3.1.183.9494' }
Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Force -TimeoutSec $TimeoutSec
Assert-AreEqual 2 $global:getRetriesAttempted "Number of unregister retries not correct"