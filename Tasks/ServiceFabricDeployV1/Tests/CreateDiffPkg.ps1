[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-TempDirectoryPath { "C:\some-path" }

$publishProfilePath = "$PSScriptRoot\data\NoAuthPublishProfile.xml"
$applicationPackagePath = "$PSScriptRoot\data\DiffPkgAssets\AppPkg"
$diffPackagePath = (Get-TempDirectoryPath) + "\DiffPackage"
$serviceConnectionName = "random connection name"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$appName = "AppName"
$overwriteBehavior = "SameAppTypeAndVersion"
$applicationTypeName = "TestType"
$applicationTypeVersion = "1.0.0"
$appManifestPath = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\ApplicationManifest.xml"
$appManifestDiffPath = $diffPackagePath + "\ApplicationManifest.xml"
$serviceManifestPath1 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless1Pkg\ServiceManifest.xml"
$serviceManifestDiffPath1 = $diffPackagePath + "\Stateless1Pkg\ServiceManifest.xml"
$codePkg1 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless1Pkg\Code"
$codeDiffPkg1 = $diffPackagePath + "\Stateless1Pkg\Code"
$serviceManifestPath2 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless2Pkg\ServiceManifest.xml"
$serviceManifestDiffPath2 = $diffPackagePath + "\Stateless2Pkg\ServiceManifest.xml"
$codePkg2 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless2Pkg\Code"
$codeDiffPkg2 = $diffPackagePath + "\Stateless2Pkg\Code"
$serviceManifestPath3 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless3Pkg\ServiceManifest.xml"
$serviceManifestDiffPath3 = $diffPackagePath + "\Stateless3Pkg\ServiceManifest.xml"
$codeZippedPkg3 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless3Pkg\Code.zip"
$codeZippedDiffPkg3 = $diffPackagePath + "\Stateless3Pkg\Code.zip"
$serviceManifestPath4 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless4Pkg\ServiceManifest.xml"
$serviceManifestDiffPath4 = $diffPackagePath + "\Stateless4Pkg\ServiceManifest.xml"
$codeZippedPkg4 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless4Pkg\Code.zip"
$codeZippedDiffPkg4 = $diffPackagePath + "\Stateless4Pkg\Code.zip"
$configPkg4 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless4Pkg\Config"
$configZippedPkg4 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless4Pkg\Config.zip"
$configDiffPkg4 = $diffPackagePath + "\Stateless4Pkg\Config"
$configZippedDiffPkg4 = $diffPackagePath + "\Stateless4Pkg\Config.zip"
$dataPkg4 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless4Pkg\Data"
$dataZippedPkg4 = "$PSScriptRoot\data\DiffPkgAssets\AppPkg\Stateless4Pkg\Data.zip"
$dataDiffPkg4 = $diffPackagePath + "\Stateless4Pkg\Data"
$dataZippedDiffPkg4 = $diffPackagePath + "\Stateless4Pkg\Data.zip"

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
Register-Mock Get-VstsInput { "true" } -- -Name useDiffPackage
Register-Mock Get-VstsInput { "false" } -- -Name overrideApplicationParameter

# Setup file resolution
Register-Mock Find-VstsFiles { $publishProfilePath } -- -LegacyPattern $publishProfilePath
Register-Mock Find-VstsFiles { $applicationPackagePath } -- -LegacyPattern $applicationPackagePath -IncludeDirectories

Register-Mock Get-ApplicationManifestPath { $appManifestDiffPath } -- -ApplicationPackagePath $diffPackagePath
Register-Mock Get-ApplicationManifestPath { $appManifestPath } -- -ApplicationPackagePath $applicationPackagePath

Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock Azure Pipelines service endpoint
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
    "ApplicationTypeName"    = $applicationTypeName;
    "ApplicationTypeVersion" = $applicationTypeVersion
}

Register-Mock Get-ServiceFabricApplicationAction { $app } -- -ApplicationName $appName
$publishArgs = @("-ApplicationParameterFilePath:", "$PSScriptRoot\data\ApplicationParameters.xml", "-OverwriteBehavior:", $overwriteBehavior, "-ApplicationPackagePath:", $diffPackagePath, "-ErrorAction:", "Stop", "-Action:", "RegisterAndCreate")
Register-Mock Publish-NewServiceFabricApplication -Arguments $publishArgs

$serviceType1 = @{
    "ServiceManifestName" = "Stateless1Pkg"
}
$serviceType2 = @{
    "ServiceManifestName" = "Stateless2Pkg"
}
$serviceType3 = @{
    "ServiceManifestName" = "Stateless3Pkg"
}
$serviceType4 = @{
    "ServiceManifestName" = "Stateless4Pkg"
}
$serviceTypes = @($serviceType1, $serviceType2, $serviceType3, $serviceType4)
$serviceManifest1 = '<ServiceManifest Name="Stateless1Pkg" Version="1.0.0">' +
'<ServiceTypes>' +
'<StatelessServiceType ServiceTypeName="Stateless1Type" />' +
'</ServiceTypes>' +
'<CodePackage Name="Code" Version="1.0.0">' +
'</CodePackage>' +
'<ConfigPackage Name="Config" Version="1.0.0" />' +
'</ServiceManifest>'
$serviceManifest2 = '<ServiceManifest Name="Stateless2Pkg" Version="1.0.0">' +
'<ServiceTypes>' +
'<StatelessServiceType ServiceTypeName="Stateless2Type" />' +
'</ServiceTypes>' +
'<CodePackage Name="Code" Version="1.0.0">' +
'</CodePackage>' +
'<ConfigPackage Name="Config" Version="1.0.0" />' +
'</ServiceManifest>'
$serviceManifest3 = '<ServiceManifest Name="Stateless3Pkg" Version="1.0.0">' +
'<ServiceTypes>' +
'<StatelessServiceType ServiceTypeName="Stateless3Type" />' +
'</ServiceTypes>' +
'<CodePackage Name="Code" Version="1.0.0">' +
'</CodePackage>' +
'<ConfigPackage Name="Config" Version="1.0.0" />' +
'</ServiceManifest>'
$serviceManifest4 = '<ServiceManifest Name="Stateless4Pkg" Version="1.0.0">' +
'<ServiceTypes>' +
'<StatelessServiceType ServiceTypeName="Stateless4Type" />' +
'</ServiceTypes>' +
'<CodePackage Name="Code" Version="1.0.0" />' +
'<ConfigPackage Name="Config" Version="1.0.0" />' +
'<DataPackage Name="Data" Version="1.0.0" />' +
'</ServiceManifest>'

Register-Mock Test-ServiceFabricApplicationPackage {$true} -- -ApplicationPackagePath $applicationPackagePath
Register-Mock Get-ServiceFabricServiceTypeAction {$serviceTypes} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion
Register-Mock Get-ServiceFabricServiceManifestAction {$serviceManifest1} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless1Pkg"
Register-Mock Get-ServiceFabricServiceManifestAction {$serviceManifest2} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless2Pkg"
Register-Mock Get-ServiceFabricServiceManifestAction {$serviceManifest3} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless3Pkg"
Register-Mock Get-ServiceFabricServiceManifestAction {$serviceManifest4} -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless4Pkg"

Register-Mock Copy-Item {} -LiteralPath $appManifestPath $appManifestDiffPath -Force
Register-Mock Test-Path { $true } -- -LiteralPath $codePkg1
Register-Mock Test-Path { $true } -- -LiteralPath $codePkg2
Register-Mock Test-Path { $true } -- -LiteralPath $codeZippedPkg3
Register-Mock Test-Path { $true } -- -LiteralPath $codeZippedPkg4
Register-Mock Test-Path { $false } -- -LiteralPath $configZippedPkg4
Register-Mock Test-Path { $true } -- -LiteralPath $configPkg4
Register-Mock Test-Path { $false } -- -LiteralPath $dataZippedPkg4
Register-Mock Test-Path { $false } -- -LiteralPath $dataPkg4

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Create-DiffPackage.psm1"
Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\ps_modules\TlsHelper_"
Register-Mock Write-VstsTaskError

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricDeployV1/deploy.ps1 )

# Assert
Assert-WasCalled Copy-Item -LiteralPath $appManifestPath $appManifestDiffPath -Force
Assert-WasCalled Copy-Item -LiteralPath $serviceManifestPath1 $serviceManifestDiffPath1 -Force -Times 0
Assert-WasCalled Copy-Item -LiteralPath $serviceManifestPath2 $serviceManifestDiffPath2 -Force
Assert-WasCalled Copy-Item -LiteralPath $serviceManifestPath3 $serviceManifestDiffPath3 -Force -Times 0
Assert-WasCalled Copy-Item -LiteralPath $serviceManifestPath4 $serviceManifestDiffPath4 -Force
Assert-WasCalled Copy-Item -LiteralPath $codePkg1 $codeDiffPkg1 -Recurse -Times 0
Assert-WasCalled Copy-Item -LiteralPath $codePkg2 $codeDiffPkg2 -Recurse
Assert-WasCalled Copy-Item -LiteralPath $codeZippedPkg3 $codeZippedDiffPkg3 -Recurse -Times 0
Assert-WasCalled Copy-Item -LiteralPath $codeZippedPkg4 $codeZippedDiffPkg4 -Recurse
Assert-WasCalled Copy-Item -LiteralPath $configZippedPkg4 $configZippedDiffPkg4 -Recurse -Times 0
Assert-WasCalled Copy-Item -LiteralPath $configPkg4 $configDiffPkg4 -Recurse
Assert-WasCalled Copy-Item -LiteralPath $dataZippedPkg4 $dataZippedDiffPkg4 -Recurse -Times 0
Assert-WasCalled Copy-Item -LiteralPath $dataPkg4 $dataDiffPkg4 -Recurse -Times 0
Assert-WasCalled Publish-NewServiceFabricApplication -Arguments $publishArgs