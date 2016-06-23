[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$pkgPath = "$PSScriptRoot\pkg"

try
{
    # Arrange.

    # Setup working package folder
    New-Item $pkgPath -Type Directory
    Copy-Item "$PSScriptRoot\data\ApplicationManifest.xml" $pkgPath
    New-Item "$pkgPath\Service" -Type Directory
    Copy-Item "$PSScriptRoot\data\ServiceManifest.xml" "$pkgPath\Service"

    $appManifestPath = "$pkgPath\ApplicationManifest.xml"
    $serviceManifestPath =  "$pkgPath\Service\ServiceManifest.xml"
    $suffix = ".TestSuffix"

    Register-Mock Get-VstsInput { $pkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $suffix } -- -Name versionSuffix -Require
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pkgPath -IncludeDirectories
    Register-Mock Find-VstsFiles { $serviceManifestPath } -- -LiteralDirectory $pkgPath -LegacyPattern "**\ServiceManifest.xml"
    Register-Mock Assert-VstsPath
    Register-Mock Get-VstsLocString

    # Act
    @( & $PSScriptRoot/../../../Tasks/ServiceFabricUpdateAppVersions/version.ps1 )

    # Assert
    Copy-Item $appManifestPath $PSScriptRoot
    $appManifest = [xml](Get-Content $appManifestPath)
    Assert-AreEqual "1.0.0$suffix" $appManifest.ApplicationManifest.ApplicationTypeVersion

    $serviceManifest = [xml](Get-Content $serviceManifestPath)
    Assert-AreEqual "1.0.0$suffix" $serviceManifest.ServiceManifest.Version
    Assert-AreEqual "1.0.0$suffix" $serviceManifest.ServiceManifest.CodePackage.Version
    Assert-AreEqual "1.0.0$suffix" $serviceManifest.ServiceManifest.ConfigPackage.Version
    Assert-AreEqual "1.0.0$suffix" $serviceManifest.ServiceManifest.DataPackage.Version
}
finally
{
    Remove-Item -Recurse -Force $pkgPath
}


