[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."

Microsoft.PowerShell.Core\Import-Module $taskPath\Assert-SingleItem.psm1
Microsoft.PowerShell.Core\Import-Module $taskPath\Update-ServiceVersions.psm1
Microsoft.PowerShell.Core\Import-Module $taskPath\Update-PackageVersion.psm1
Microsoft.PowerShell.Core\Import-Module $taskPath\Update-ApplicationVersions.psm1

$pkgPath = "$PSScriptRoot\pkg"

try
{
    # Arrange.

    # Setup working package folder
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\" -Destination $pkgPath -Container -Recurse

    $suffix = ".TestSuffix"

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $suffix } -- -Name versionSuffix -Require
    Register-Mock Get-VstsInput { "Manifest versions" } -- -Name updateType -Require
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Assert-VstsPath

    Register-Mock Get-VstsBuild
    Register-Mock Find-FileChanges
    Register-Mock Test-XmlEqual

    # Act
    . $taskPath\Update-Manifests.ps1

    # Assert
    $appManifest = [xml](Get-Content -LiteralPath "$pkgPath\ApplicationManifest.xml")
    Assert-AreEqual "1.0.0$suffix" $appManifest.ApplicationManifest.ApplicationTypeVersion "App type version was not updated."
    Assert-AreEqual "1.0.0$suffix" $appManifest.ApplicationManifest.ServiceManifestImport[0].ServiceManifestRef.ServiceManifestVersion "Service 1 version was not updated in app manifest."
    Assert-AreEqual "1.0.0$suffix" $appManifest.ApplicationManifest.ServiceManifestImport[1].ServiceManifestRef.ServiceManifestVersion "Service 2 version was not updated in app manifest."

    $service1Manifest = [xml](Get-Content -LiteralPath "$pkgPath\Service1Pkg\ServiceManifest.xml")
    Assert-AreEqual "1.0.0$suffix" $service1Manifest.ServiceManifest.Version "Service version was not updated in service 1 manifest."
    Assert-AreEqual "1.0.0$suffix" $service1Manifest.ServiceManifest.CodePackage.Version "Code package version was not updated in service 1 manifest."
    Assert-AreEqual "1.0.0$suffix" $service1Manifest.ServiceManifest.ConfigPackage.Version "Config package version was not updated in service 1 manifest."
    Assert-AreEqual "1.0.0$suffix" $service1Manifest.ServiceManifest.DataPackage.Version "Data package version was not updated in service 1 manifest."

    $service2Manifest = [xml](Get-Content -LiteralPath "$pkgPath\Service2Pkg\ServiceManifest.xml")
    Assert-AreEqual "1.0.0$suffix" $service2Manifest.ServiceManifest.Version "Service version was not updated in service 2 manifest."
    Assert-AreEqual "1.0.0$suffix" $service2Manifest.ServiceManifest.CodePackage.Version "Code package version was not updated in service 2 manifest."
    Assert-AreEqual "1.0.0$suffix" $service2Manifest.ServiceManifest.ConfigPackage.Version "Config package version was not updated in service 2 manifest."
    Assert-AreEqual "1.0.0$suffix" $service2Manifest.ServiceManifest.DataPackage.Version "Data package version was not updated in service 2 manifest."

    # Verify the performance-affecting modules are not called when all versions are being updated
    Assert-WasCalled Get-VstsBuild -Times 0
    Assert-WasCalled Find-FileChanges -Times 0
    Assert-WasCalled Test-XmlEqual -Times 0
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath
}