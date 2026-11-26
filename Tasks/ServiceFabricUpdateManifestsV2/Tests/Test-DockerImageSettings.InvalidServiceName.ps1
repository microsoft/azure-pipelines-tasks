[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$pkgPath = "$PSScriptRoot\pkg"
$outsideServicePath = "$PSScriptRoot\OutsideService"
$imageDigestsPath = "$PSScriptRoot\data\TaggedDockerImageAssets\ImageDigestOutput.txt"
$imageNamesPath = "$PSScriptRoot\data\TaggedDockerImageAssets\BuiltDockerImages.txt"

try
{
    Copy-Item -LiteralPath "$PSScriptRoot\data\TaggedDockerImageAssets\AppPkg\" -Destination $pkgPath -Container -Recurse
    Copy-Item -LiteralPath "$pkgPath\Service1Pkg" -Destination $outsideServicePath -Container -Recurse

    $appManifestPath = "$pkgPath\ApplicationManifest.xml"
    $appManifestXml = [xml](Get-Content -LiteralPath $appManifestPath)
    $appManifestXml.ApplicationManifest.ServiceManifestImport[0].ServiceManifestRef.ServiceManifestName = '..\OutsideService'
    $appManifestXml.Save($appManifestPath)
    $outsideManifestPath = "$outsideServicePath\ServiceManifest.xml"
    $outsideManifestBefore = Get-Content -LiteralPath $outsideManifestPath -Raw

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $imageDigestsPath } -- -Name imageDigestsPath -Require
    Register-Mock Get-VstsInput { $imageNamesPath } -- -Name imageNamesPath
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Find-VstsFiles { $imageDigestsPath } -- -LegacyPattern $imageDigestsPath
    Register-Mock Find-VstsFiles { $imageNamesPath } -- -LegacyPattern $imageNamesPath

    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-DockerImageSettings.psm1"

    $errorMessage = $null
    try
    {
        Update-DockerImageSettings
    }
    catch
    {
        $errorMessage = $_.Exception.Message
    }

    Assert-AreEqual 'InvalidManifestPathSegment ServiceManifestRef/@ServiceManifestName ..\OutsideService' $errorMessage
    Assert-AreEqual $outsideManifestBefore (Get-Content -LiteralPath $outsideManifestPath -Raw) "The manifest outside the application package was modified."
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force -LiteralPath $outsideServicePath -ErrorAction SilentlyContinue
}
