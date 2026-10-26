[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ApplicationVersions.psm1"

# The markers are in folder names, so keep them short: Windows PowerShell 5.1 fails on directory paths of 248 characters or more.
$workRoot = "$PSScriptRoot\wPrev"
$packageDirName = 'pkg##vso[task.debug]x'
$inertPackageDirName = 'pkg##_vso[task.debug]x'
$newPkgPath = "$workRoot\new\$packageDirName"
$oldDropLocation = "$workRoot\old##vso[task.debug]x"
$inertOldDropLocation = "$workRoot\old##_vso[task.debug]x"
$oldPkgPath = "$oldDropLocation\$packageDirName"

try
{
    # Arrange: the package folder name, the previous build's drop folder, the application type name and the previous build's version carry markers.
    New-Item -ItemType Directory -Path "$workRoot\new" -Force | Out-Null
    New-Item -ItemType Directory -Path "$workRoot\oldStaging" -Force | Out-Null
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\" -Destination "$workRoot\new\pkg" -Container -Recurse
    Rename-Item -LiteralPath "$workRoot\new\pkg" -NewName $packageDirName
    Copy-Item -LiteralPath "$PSScriptRoot\data\PreviousPkgVersionPrefixChanged\pkg\" -Destination "$workRoot\oldStaging\pkg" -Container -Recurse
    Rename-Item -LiteralPath "$workRoot\oldStaging\pkg" -NewName $packageDirName
    Rename-Item -LiteralPath "$workRoot\oldStaging" -NewName (Split-Path -Leaf $oldDropLocation)

    $newManifestPath = "$newPkgPath\ApplicationManifest.xml"
    $newManifest = [xml](Get-Content -LiteralPath $newManifestPath)
    $newManifest.ApplicationManifest.ApplicationTypeName = 'AppType##vso[task.setvariable variable=P1]x'
    $newManifest.Save($newManifestPath)

    $oldManifestPath = "$oldPkgPath\ApplicationManifest.xml"
    $oldManifest = [xml](Get-Content -LiteralPath $oldManifestPath)
    $oldManifest.ApplicationManifest.ApplicationTypeVersion = '0.9.9##vso[task.setvariable variable=P8]x'
    $oldManifest.Save($oldManifestPath)

    Register-Mock Get-VstsInput { $newPkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { '.NewSuffix' } -- -Name versionSuffix -Require
    Register-Mock Get-VstsInput { $true } -- -Name updateOnlyChanged -Require
    Register-Mock Find-VstsFiles { $newPkgPath } -- -LegacyPattern $newPkgPath -IncludeDirectories
    Register-Mock Assert-VstsPath
    Register-Mock Assert-SingleItem
    Register-Mock Get-VstsBuild { $oldDropLocation }
    Register-Mock Update-ServiceVersions { '1.0.0.OldSuffix' }
    Register-Mock Get-VstsTaskVariable { $PSScriptRoot } -- -Name Build.SourcesDirectory -Require
    Register-HostCapture

    # Act: the function also leaks the relative package path to the output pipeline, so capture that as well.
    $output = @(Update-ApplicationVersions)

    # Assert
    Assert-NoLiveLoggingCommands
    Assert-LogLineWritten "PreviousBuildLocationLabel $inertOldDropLocation"
    Assert-LogLineWritten 'SearchingApplicationType AppType##_vso[task.setvariable variable=P1]x'
    Assert-LogLineWritten "PreviousPackageLocation $inertOldDropLocation\$inertPackageDirName"
    Assert-LogLineWritten '  AppManifestChanged'
    Assert-LogLineWritten '  UpdatedApplicationTypeVersionFromPrevious AppType##_vso[task.setvariable variable=P1]x 0.9.9##_vso[task.setvariable variable=P8]x 1.0.0.NewSuffix'

    Assert-AreEqual 1 $output.Count "Unexpected pipeline output: $($output -join ' | ')"
    Assert-NoLiveLoggingCommands -Lines $output
    Assert-AreEqual $true $output[0].EndsWith($inertPackageDirName) "The relative package path was not neutralized: $($output[0])"
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $workRoot -ErrorAction SilentlyContinue
}
