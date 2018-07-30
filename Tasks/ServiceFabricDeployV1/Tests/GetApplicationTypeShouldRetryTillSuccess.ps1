[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$applicationType = {
    ApplicationTypeName = $ApplicationTypeName
    ApplicationTypeVersion = $ApplicationTypeVersion
}
$global:retriesAttempted = 0

$getApplicationTypeParams = @{
    'ApplicationTypeName'    = $ApplicationTypeName;
    'ApplicationTypeVersion' = $ApplicationTypeVersion
    'UsePaging' = $true
}

Register-Mock Get-ServiceFabricApplicationType {
    if ($global:retriesAttempted -eq 1)
    {
        return $applicationType
    }

    $global:retriesAttempted++;
    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- @getApplicationTypeParams

Register-Mock Get-SfSdkVersion { '3.1.183.9494' }
Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
Assert-AreEqual 1 $global:retriesAttempted "Number of retries not correct"