[CmdletBinding()]
param()

# Security regression test for the path traversal in Create-DiffPackage.psm1.
#
# ServiceManifestRef/@ServiceManifestName is read out of the local ApplicationManifest.xml and used
# to be joined straight onto the application package path (to read ServiceManifest.xml) and onto the
# diff package path (to write the service package). A name containing '..' therefore escaped both
# directories. The task must now fail closed before any file is touched.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-TempDirectoryPath { "C:\some-path" }

$publishProfilePath = "$PSScriptRoot\data\NoAuthPublishProfile.xml"
$applicationPackagePath = "$PSScriptRoot\data\DiffPkgTraversalAssets\SvcManifestNameTraversal\AppPkg"
$diffPackagePath = (Get-TempDirectoryPath) + "\DiffPackage"
$serviceConnectionName = "random connection name"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$appName = "AppName"
$overwriteBehavior = "SameAppTypeAndVersion"
$applicationTypeName = "TestType"
$applicationTypeVersion = "1.0.0"
$appManifestPath = "$applicationPackagePath\ApplicationManifest.xml"
$appManifestDiffPath = $diffPackagePath + "\ApplicationManifest.xml"

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

$serviceType1 = @{
    "ServiceManifestName" = "Stateless1Pkg"
}
$serviceTypes = @($serviceType1)

$serviceManifest1 = '<ServiceManifest Name="Stateless1Pkg" Version="1.0.0">' +
'<ServiceTypes>' +
'<StatelessServiceType ServiceTypeName="Stateless1Type" />' +
'</ServiceTypes>' +
'<CodePackage Name="Code" Version="1.0.0">' +
'</CodePackage>' +
'<ConfigPackage Name="Config" Version="1.0.0" />' +
'</ServiceManifest>'

Register-Mock Test-ServiceFabricApplicationPackage { $true } -- -ApplicationPackagePath $applicationPackagePath
Register-Mock Get-ServiceFabricServiceTypeAction { $serviceTypes } -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion
Register-Mock Get-ServiceFabricServiceManifestAction { $serviceManifest1 } -- -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $applicationTypeVersion -ServiceManifestName "Stateless1Pkg"

Register-Mock Copy-Item {}
Register-Mock Publish-NewServiceFabricApplication {}

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Create-DiffPackage.psm1"
Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\ps_modules\TlsHelper_"
Register-Mock Write-VstsTaskError
# deploy.ps1's catch block reports telemetry before rethrowing. It is not available in the test
# harness, so mock it to let the original validation failure surface.
Register-Mock Publish-Telemetry

# Act / Assert
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
Assert-Throws {
    @( & $PSScriptRoot/../../../Tasks/ServiceFabricDeployV1/deploy.ps1 )
} -MessagePattern "*ServiceManifestRef/@ServiceManifestName*"

# Only the application manifest may have been copied; the escaping service package must not be, and
# the deployment must not go ahead.
Assert-WasCalled Copy-Item -LiteralPath "$applicationPackagePath\..\..\..\Evil" "$diffPackagePath\..\..\..\Evil" -Recurse -Times 0
Assert-WasCalled Publish-NewServiceFabricApplication -Times 0
