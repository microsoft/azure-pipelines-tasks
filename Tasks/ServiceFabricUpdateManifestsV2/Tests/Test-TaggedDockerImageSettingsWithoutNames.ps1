[CmdletBinding()]
param(
)

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$pkgPath = "$PSScriptRoot\pkg"
$imageDigestsPath = "$PSScriptRoot\data\TaggedDockerImageAssets\ImageDigestOutput.txt"
$imageNamesPath = $null

try
{
    # Arrange.

    # Setup working package folder
    Copy-Item -LiteralPath "$PSScriptRoot\data\TaggedDockerImageAssets\AppPkg\" -Destination $pkgPath -Container -Recurse

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $imageDigestsPath } -- -Name imageDigestsPath -Require
    Register-Mock Get-VstsInput { $imageNamesPath } -- -Name imageNamesPath
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Find-VstsFiles { $imageDigestsPath } -- -LegacyPattern $imageDigestsPath
    Register-Mock Find-VstsFiles { $imageNamesPath } -- -LegacyPattern $imageNamesPath

    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-DockerImageSettings.psm1"

    # Act
    Update-DockerImageSettings

    # Assert
    $serviceManifestXml = [xml](Get-Content -LiteralPath "$pkgPath\Service1Pkg\ServiceManifest.xml")
    Assert-AreEqual "myacr.azurecr.io/image1@sha256:fe15a6d249761e301a577f908aa2e03849869f5731f818e20fef14af499f5fe7" $serviceManifestXml.ServiceManifest.CodePackage.EntryPoint.ContainerHost.ImageName "Service1 image name did not match."
    $serviceManifestXml = [xml](Get-Content -LiteralPath "$pkgPath\Service2Pkg\ServiceManifest.xml")
    Assert-AreEqual "myacr.azurecr.io/image2@sha256:51e69f0fb28edfe11b50ed0bfe3a6621445dfef040de53b309bf47750648fb68" $serviceManifestXml.ServiceManifest.CodePackage.EntryPoint.ContainerHost.ImageName "Service1 image name did not match."
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath
}