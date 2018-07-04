[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$ApplicationTypeName = "app type name"
$ApplicationTypeVersion = "app type version"
$applicationPackagePathInImageStore = "image path"

$UpgradeParameters = @{
    'ApplicationTypeName'    = $ApplicationTypeName;
    'ApplicationTypeVersion' = $ApplicationTypeVersion
    'ApplicationParameter'   = {}
}

$upgradeStatus = @{
    'UpgradeState' = 'RollingForwardCompleted'
}
$global:startUpgradeAttempted = 0
$global:getRetriesAttempted = 0
$global:appHealthPrinted = $false

Register-Mock Start-ServiceFabricApplicationUpgrade {
    $global:startUpgradeAttempted++
    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- @UpgradeParameters

Register-Mock Get-ServiceFabricApplicationUpgrade {
    $global:getRetriesAttempted++

    if ($global:getRetriesAttempted -eq 6)
    {
        $upgradeStatus.UpgradeState = 'RollingForwardInProgress'
        return $upgradeStatus
    }

    if ($global:getRetriesAttempted -eq 3)
    {
        $upgradeStatus.UpgradeState = 'RollingForwardCompleted'
        return $upgradeStatus
    }

    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- -ApplicationName $ApplicationName

Register-Mock Get-ServiceFabricApplicationHealth {
    $global:appHealthPrinted = $true
}

Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Start-ServiceFabricApplicationUpgradeAction -UpgradeParameters $UpgradeParameters
Assert-AreEqual 2 $global:startUpgradeAttempted "Number of start upgrade retries not correct"