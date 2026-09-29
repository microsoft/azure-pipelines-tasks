[CmdletBinding()]
param()

# Security regression test for the path traversal in Update-DockerSettings.psm1.
#
# ServiceManifestRef/@ServiceManifestName is read out of the local ApplicationManifest.xml and used to
# be joined straight onto the application package path to open the service manifest - before any of the
# diff-package validation runs, and even when diff packaging is disabled (configureDockerSettings is
# applied unconditionally). A relative name ('..\..\x') could therefore read a file outside the
# application package, and a UNC name ('\\server\share\x') could cause an outbound SMB request. The task
# must now fail closed before the service manifest is opened.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$publishProfilePath = "$PSScriptRoot\data\NoAuthPublishProfile.xml"
$applicationPackagePath = "$PSScriptRoot\data\DiffPkgTraversalAssets\SvcManifestNameTraversal\AppPkg"
$serviceConnectionName = "random connection name"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$appName = "AppName"
$overwriteBehavior = "SameAppTypeAndVersion"

# Setup input arguments
Register-Mock Get-VstsInput { $publishProfilePath } -- -Name publishProfilePath
Register-Mock Get-VstsInput { $applicationPackagePath } -- -Name applicationPackagePath -Require
Register-Mock Get-VstsInput { $serviceConnectionName } -- -Name serviceConnectionName -Require
Register-Mock Get-VstsInput { "false" } -- -Name compressPackage
Register-Mock Get-VstsInput { $overwriteBehavior } -- -Name overwriteBehavior
Register-Mock Get-VstsInput { "false" } -- -Name skipUpgradeSameTypeAndVersion
Register-Mock Get-VstsInput { "false" } -- -Name skipPackageValidation
Register-Mock Get-VstsInput { "false" } -- -Name unregisterUnusedVersions
Register-Mock Get-VstsInput { "true" } -- -Name configureDockerSettings
Register-Mock Get-VstsInput { "UsernamePassword" } -- -Name registryCredentials -Require
Register-Mock Get-VstsInput { "someuser" } -- -Name registryUserName -Require
Register-Mock Get-VstsInput { "somepassword" } -- -Name registryPassword -Require
Register-Mock Get-VstsInput { "false" } -- -Name passwordEncrypted -Require
Register-Mock Get-VstsInput { "false" } -- -Name useDiffPackage
Register-Mock Get-VstsInput { "false" } -- -Name overrideApplicationParameter

# Setup file resolution
Register-Mock Find-VstsFiles { $publishProfilePath } -- -LegacyPattern $publishProfilePath
Register-Mock Find-VstsFiles { $applicationPackagePath } -- -LegacyPattern $applicationPackagePath -IncludeDirectories

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

Register-Mock Publish-NewServiceFabricApplication {}

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-DockerSettings.psm1"
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

# The deployment must not proceed once the docker settings update fails closed.
Assert-WasCalled Publish-NewServiceFabricApplication -Times 0
