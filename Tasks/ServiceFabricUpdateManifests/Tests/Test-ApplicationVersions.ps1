[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $PreviousPkgName,

    [switch]
    $Service1Changed,

    [string]
    $PackageSubPath = ""
)

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

$pkgPath = "$PSScriptRoot\${PackageSubPath}pkg"
$oldDropLocation = "$PSScriptRoot\data\$PreviousPkgName"
$oldPkgPath = "$oldDropLocation\pkg"

try
{
    # Arrange.

    # Setup working package folder
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\" -Destination $pkgPath -Container -Recurse

    $newSuffix = ".NewSuffix"
    $oldSuffix = ".OldSuffix"

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $newSuffix } -- -Name versionSuffix -Require
    Register-Mock Get-VstsInput { $true } -- -Name updateOnlyChanged -Require
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Assert-VstsPath
    Register-Mock Assert-SingleItem

    Register-Mock Get-VstsBuild { $oldDropLocation }

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

    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-ApplicationVersions.psm1"

    # Act
    Update-ApplicationVersions

    # Assert
    $appManifest = [xml](Get-Content -LiteralPath "$pkgPath\ApplicationManifest.xml")
    Assert-AreEqual "1.0.0$newSuffix" $appManifest.ApplicationManifest.ApplicationTypeVersion "App type version did not match."
    Assert-AreEqual $expectedService1Version $appManifest.ApplicationManifest.ServiceManifestImport[0].ServiceManifestRef.ServiceManifestVersion "Service 1 version did not match."
    Assert-AreEqual "1.0.0$oldSuffix" $appManifest.ApplicationManifest.ServiceManifestImport[1].ServiceManifestRef.ServiceManifestVersion "Service 2 version did not match."
    Assert-WasCalled Update-ServiceVersions -ParametersEvaluator {
        return $NewPackageRoot -eq $pkgPath -and `
        ($PreviousPkgName -eq "PreviousPackageNoManifest") -or $OldPackageRoot -eq $oldPkgPath
    }
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath
}