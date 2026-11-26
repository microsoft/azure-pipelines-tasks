[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Assert-SingleItem.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ServiceVersions.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-PackageVersion.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ApplicationVersions.psm1"

# The marker is in a folder name, so keep it short: Windows PowerShell 5.1 fails on directory paths of 248 characters or more.
$pkgPath = "$PSScriptRoot\pkgAll"
$serviceName = 'Svc##vso[task.debug]x'
$inertServiceName = 'Svc##_vso[task.debug]x'
$suffix = '.S##vso[task.setvariable variable=P6]x'
$inertSuffix = '.S##_vso[task.setvariable variable=P6]x'
$pattern = "$pkgPath\**##vso[task.setvariable variable=P7]x"

try
{
    # Arrange: every value the task logs carries a logging-command marker (manifest values, names and task inputs); the service version starts its marker on a new line.
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\" -Destination $pkgPath -Container -Recurse
    Rename-Item -LiteralPath "$pkgPath\Service1Pkg" -NewName $serviceName

    $appManifestPath = "$pkgPath\ApplicationManifest.xml"
    $appManifest = [xml](Get-Content -LiteralPath $appManifestPath)
    $appManifest.ApplicationManifest.ApplicationTypeName = 'AppType##vso[task.setvariable variable=P1]x'
    $appManifest.ApplicationManifest.ApplicationTypeVersion = '1.0.0##vso[task.setvariable variable=P2]x'
    $appManifest.ApplicationManifest.ServiceManifestImport[0].ServiceManifestRef.ServiceManifestName = $serviceName
    $appManifest.Save($appManifestPath)

    $serviceManifestPath = "$pkgPath\$serviceName\ServiceManifest.xml"
    $serviceManifest = [xml](Get-Content -LiteralPath $serviceManifestPath)
    $serviceManifest.ServiceManifest.Version = "1.0.0`n##vso[task.setvariable variable=P4]x"
    $serviceManifest.ServiceManifest.CodePackage.Name = 'Code##vso[task.setvariable variable=P5]x'
    $serviceManifest.Save($serviceManifestPath)

    Register-Mock Get-VstsInput { $pattern } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { $suffix } -- -Name versionSuffix -Require
    Register-Mock Find-VstsFiles { $pkgPath } -- -LegacyPattern $pattern -IncludeDirectories
    Register-Mock Assert-VstsPath
    Register-HostCapture

    # Act
    Update-ApplicationVersions

    # Assert: nothing is executable, and nothing but the marker was altered.
    Assert-NoLiveLoggingCommands
    Assert-LogLineWritten "SearchingForApplicationPackage $pkgPath\**##_vso[task.setvariable variable=P7]x"
    Assert-LogLineWritten "FoundApplicationPackage $pkgPath"
    Assert-LogLineWritten "VersionValueLabel $inertSuffix"
    Assert-LogLineWritten "UpdatedApplicationTypeVersion AppType##_vso[task.setvariable variable=P1]x 1.0.0##_vso[task.setvariable variable=P2]x$inertSuffix"
    Assert-LogLineWritten "    UpdatedServiceVerison $inertServiceName 1.0.0`n##_vso[task.setvariable variable=P4]x$inertSuffix"
    Assert-LogLineWritten "      UpdatedPackageVerison $inertServiceName Code##_vso[task.setvariable variable=P5]x 1.0.0$inertSuffix"
    Assert-LogLineWritten "    UpdatedServiceVerison Service2Pkg 1.0.0$inertSuffix"
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath -ErrorAction SilentlyContinue
}
