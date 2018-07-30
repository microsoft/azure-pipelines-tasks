[CmdletBinding()]
param()

Import-Module ServiceFabric
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$applicationPackagePath = "random package path"
$global:retriesAttempted = 0

$copyParameters = @{
    "ApplicationPackagePath" = $applicationPackagePath
}

Register-Mock Copy-ServiceFabricApplicationPackage {
    $global:retriesAttempted++;
    throw [System.Fabric.FabricTransientException]::new("Could not ping!")
} -- @copyParameters

Register-Mock Start-Sleep {}
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\PowershellHelpers\Helpers.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

# Act/Assert
Assert-Throws {
    Copy-ServiceFabricApplicationPackageAction -CopyParameters $copyParameters
} -MessagePattern "Could not ping!"
Assert-AreEqual 3 $global:retriesAttempted "Number of retries not correct"