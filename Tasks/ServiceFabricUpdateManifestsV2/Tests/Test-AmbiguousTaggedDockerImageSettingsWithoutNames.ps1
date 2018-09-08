[CmdletBinding()]
param(
)

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$pkgPath = "$PSScriptRoot\pkg"
$imageDigestsPath = "$PSScriptRoot\data\AmbiguousTaggedDockerImageAssets\ImageDigestOutput.txt"
$imageNamesPath = $null

try
{
    # Arrange.

    # Setup working package folder
    Copy-Item -LiteralPath "$PSScriptRoot\data\AmbiguousTaggedDockerImageAssets\AppPkg\" -Destination $pkgPath -Container -Recurse

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $imageDigestsPath } -- -Name imageDigestsPath -Require
    Register-Mock Get-VstsInput { $imageNamesPath } -- -Name imageNamesPath
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Find-VstsFiles { $imageDigestsPath } -- -LegacyPattern $imageDigestsPath
    Register-Mock Find-VstsFiles { $imageNamesPath } -- -LegacyPattern $imageNamesPath

    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-DockerImageSettings.psm1"

    $threw = $false
    try {
        # Act
        Update-DockerImageSettings
    }
    catch {
        $threw = $true
    }

    # Assert
    Assert-AreEqual $threw $true "Update-DockerImageSettings should have thrown."
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath
}