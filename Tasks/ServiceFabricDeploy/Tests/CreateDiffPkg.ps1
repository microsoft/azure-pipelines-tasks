[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$publishProfilePath = "$PSScriptRoot\data\NoAuthPublishProfile.xml"
$applicationPackagePath = "$PSScriptRoot\data\DiffPkgAssets\AppPkg"
$diffPackagePath = "$PSScriptRoot\data\DiffPkgAssets\DiffPackage"
$serviceConnectionName = "random connection name"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$appName = "AppName"
$overwriteBehavior = "SameAppTypeAndVersion"
$diffPkgAssetsPath = "$PSScriptRoot\data\DiffPkgAssets"
$applicationTypeName = "TestType"
$applicationTypeVersion = "1.0.0"
$appManifestPath = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\ApplicationManifest.xml"
$appManifestDiffPath = "$PSScriptRoot\data\DiffPkgAssets\DiffPackage\ApplicationManifest.xml"
$serviceManifestPath2 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless2Pkg\ServiceManifest.xml"
$serviceManifestDiffPath2 = "$PSScriptRoot\data\DiffPkgAssets\DiffPackage\Stateless2Pkg\ServiceManifest.xml"
$codePkg2 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless2Pkg\Code"
$codeDiffPkg2 = "$PSScriptRoot\data\DiffPkgAssets\DiffPackage\Stateless2Pkg\Code"

# Setup input arguments
Register-Mock Get-VstsInput { $publishProfilePath } -- -Name publishProfilePath
Register-Mock Get-VstsInput { $applicationPackagePath } -- -Name applicationPackagePath -Require
Register-Mock Get-VstsInput { $serviceConnectionName } -- -Name serviceConnectionName -Require
Register-Mock Get-VstsInput { "false" } -- -Name compressPackage
Register-Mock Get-VstsInput { $overwriteBehavior } -- -Name overwriteBehavior
Register-Mock Get-VstsInput { "false" } -- -Name skipUpgradeSameTypeAndVersion
Register-Mock Get-VstsInput { "false" } -- -Name skipPackageValidation
Register-Mock Get-VstsInput { "false" } -- -Name unregisterUnusedVersions
Register-Mock Get-VstsInput { "false" } -- -Name configureDockerSettings
Register-Mock Get-VstsInput { $true }  --  -Name useDiffPackage
Register-Mock Get-VstsInput { $diffPkgAssetsPath } -- -Name diffPackagePath -Require

# Setup file resolution
Register-Mock Find-VstsFiles { $publishProfilePath } -- -LegacyPattern $publishProfilePath
Register-Mock Find-VstsFiles { $applicationPackagePath } -- -LegacyPattern $applicationPackagePath -IncludeDirectories

Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock VSTS service endpoint
$vstsEndpoint = @{
    "Auth" = @{
        "Scheme" = "None"
    }
}
Register-Mock Get-VstsEndpoint { $vstsEndpoint } -- -Name $serviceConnectionName -Require

# Setup mock for connection to cluster
Register-Mock Connect-ServiceFabricCluster { $null } -- -ConnectionEndpoint "test"

# Setup mock registry settings
$regKeyObj = @{
    "FabricSDKPSModulePath" = $serviceFabricSdkModulePath
}
Register-Mock Get-ItemProperty { $regKeyObj } -- -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKPSModulePath

Register-Mock Get-ApplicationNameFromApplicationParameterFile { $appName } -- "$PSScriptRoot\data\ApplicationParameters.xml"

$app = @{
    "ApplicationTypeName" = $applicationTypeName;
    "ApplicationTypeVersion" = $applicationTypeVersion
}
Register-Mock Get-ServiceFabricApplication { $app } -- -ApplicationName $appName
$publishArgs = @("-ApplicationParameterFilePath:", "$PSScriptRoot\data\ApplicationParameters.xml", "-OverwriteBehavior:", $overwriteBehavior, "-ApplicationPackagePath:", "aaa", "-ErrorAction:", "Stop", "-Action:", "RegisterAndCreate")
Register-Mock Publish-NewServiceFabricApplication -Arguments $publishArgs

$serviceType1 = @{
    "ServiceManifestName" = "Stateless1Pkg"
}
$serviceType2 = @{
    "ServiceManifestName" = "Stateless2Pkg"
}
$serviceTypes = @($serviceType1, $serviceType2)
$serviceManifest = '<ServiceManifest Name="Stateless1Pkg" Version="1.0.0">' +
  '<ServiceTypes>' +
    '<StatelessServiceType ServiceTypeName="Stateless1Type" />' +
  '</ServiceTypes>' +
  '<CodePackage Name="Code" Version="1.0.0">' +
  '</CodePackage>' +
  '<ConfigPackage Name="Config" Version="1.0.0" />' +
'</ServiceManifest>'

Register-Mock Get-ServiceFabricServiceType {$serviceTypes} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion
Register-Mock Get-ServiceFabricServiceManifest {$serviceManifest} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless1Pkg"
Register-Mock Get-ServiceFabricServiceManifest {$serviceManifest} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless2Pkg"

Register-Mock Copy-Item {} $appManifestPath $appManifestDiffPath -Force

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Create-DiffPackage.psm1"

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeploy\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricDeploy/deploy.ps1 )

# Assert
Assert-WasCalled Copy-Item $appManifestPath $appManifestDiffPath -Force
Assert-WasCalled Copy-Item $serviceManifestPath2 $serviceManifestDiffPath2 -Force
Assert-WasCalled Copy-Item $codePkg2 $codeDiffPkg2 -Recurse
