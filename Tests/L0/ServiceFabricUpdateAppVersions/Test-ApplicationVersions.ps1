[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $PreviousPkgName,

    [switch]
    $Service1Changed
)

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\..\..\..\Tasks\ServiceFabricUpdateAppVersions"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

$pkgPath = "$PSScriptRoot\pkg"

try
{
    # Arrange.

    # Setup working package folder
    Copy-Item "$PSScriptRoot\data\CurrentPkg\" -Destination $pkgPath -Container -Recurse

    $newSuffix = ".NewSuffix"
    $oldSuffix = ".OldSuffix"

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $newSuffix } -- -Name versionSuffix -Require
    Register-Mock Get-VstsInput { $true } -- -Name updateOnlyChanged -Require
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Assert-VstsPath
    Register-Mock Assert-SingleItem

    Register-Mock Get-VstsBuild { "$PSScriptRoot\data\$PreviousPkgName" }

    Register-Mock Get-VstsTaskVariable { $PSScriptRoot } -- -Name Build.SourcesDirectory -Require

    if ($Service1Changed)
    {
        $expectedService1Version = "1.0.0$newSuffix"
        Register-Mock Update-ServiceVersions { "1.0.0$newSuffix" } -ArgumentsEvaluator { $args[3] -eq "Service1Pkg" }
        Register-Mock Update-ServiceVersions { "1.0.0$oldSuffix" } -ArgumentsEvaluator { $args[3] -ne "Service1Pkg" }
    }
    else
    {
        $expectedService1Version = "1.0.0$oldSuffix"
        Register-Mock Update-ServiceVersions { "1.0.0$oldSuffix" }
    }

    # Act
    . $taskPath\Update-ApplicationVersions.ps1

    # Assert
    $appManifest = [xml](Get-Content "$pkgPath\ApplicationManifest.xml")
    Assert-AreEqual "1.0.0$newSuffix" $appManifest.ApplicationManifest.ApplicationTypeVersion "App type version did not match."
    Assert-AreEqual $expectedService1Version $appManifest.ApplicationManifest.ServiceManifestImport[0].ServiceManifestRef.ServiceManifestVersion "Service 1 version did not match."
    Assert-AreEqual "1.0.0$oldSuffix" $appManifest.ApplicationManifest.ServiceManifestImport[1].ServiceManifestRef.ServiceManifestVersion "Service 2 version did not match."
}
finally
{
    Remove-Item -Recurse -Force $pkgPath
}