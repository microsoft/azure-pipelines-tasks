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
$global:createRetriesAttempted = 0
$global:getRetriesAttempted = 0
$global:appHealthPrinted = $false

Register-Mock New-ServiceFabricApplication {
    $global:createRetriesAttempted++;

    if ($global:createRetriesAttempted -eq 3)
    {
        throw [System.TimeoutException]::new()
    }

    throw [System.Fabric.FabricTransientException]::new("Cound not ping!")
} -- -ApplicationName $ApplicationName -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -ApplicationParameter $ApplicationParameter

Register-Mock Get-ServiceFabricApplicationHealth {
    $global:appHealthPrinted = $true
}

Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Assert-Throws {
    New-ServiceFabricApplicationAction -ApplicationName $ApplicationName -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -ApplicationParameter $ApplicationParameter
}
Assert-AreEqual 3 $global:createRetriesAttempted "Number of create retries not correct"
Assert-AreEqual $true $global:appHealthPrinted "app health not printed in case of timeout"