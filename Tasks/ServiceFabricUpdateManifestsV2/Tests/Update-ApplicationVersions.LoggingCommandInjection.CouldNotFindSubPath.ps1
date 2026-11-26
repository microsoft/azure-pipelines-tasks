[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Assert-SingleItem.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ServiceVersions.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-PackageVersion.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ApplicationVersions.psm1"

# CouldNotFindSubPath logs the resolved package path and the previous build's drop location when no matching subpath can
# be found there at all (every candidate relative path is tried and the top-level drop folder itself has no manifest
# either). Both values can carry a marker: the resolved package path reflects the folder name under the repository, as
# do the other sinks covered elsewhere in this suite. This warning reaches the host through Write-Warning, not
# Write-Host, so it is captured separately here.
$workRoot = "$PSScriptRoot\wSub"
$packageDirName = 'pkg##vso[task.debug]x'
$inertPackageDirName = 'pkg##_vso[task.debug]x'
$newPkgPath = "$workRoot\new\$packageDirName"
$inertNewPkgPath = "$workRoot\new\$inertPackageDirName"
$oldDropLocation = "$workRoot\old"

try
{
    New-Item -ItemType Directory -Path $newPkgPath -Force | Out-Null
    New-Item -ItemType Directory -Path $oldDropLocation -Force | Out-Null
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\ApplicationManifest.xml" -Destination "$newPkgPath\ApplicationManifest.xml"
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\Service1Pkg" -Destination "$newPkgPath\Service1Pkg" -Recurse
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\Service2Pkg" -Destination "$newPkgPath\Service2Pkg" -Recurse
    # $oldDropLocation intentionally has no ApplicationManifest.xml and no subfolder matching $newPkgPath, so the search
    # in Update-ApplicationVersions exhausts every candidate relative path and falls through to CouldNotFindSubPath.

    Register-Mock Get-VstsInput { $newPkgPath } -- -Name applicationPackagePath -Require
    Register-Mock Get-VstsInput { '.NewSuffix' } -- -Name versionSuffix -Require
    Register-Mock Get-VstsInput { $true } -- -Name updateOnlyChanged -Require
    Register-Mock Get-VstsInput { 'drop' } -- -Name pkgArtifactName -Require
    Register-Mock Get-VstsInput { 'LastSuccessful' } -- -Name compareType -Require
    Register-Mock Get-VstsInput { '' } -- -Name buildNumber
    Register-Mock Get-VstsInput { $false } -- -Name overwriteExistingPkgArtifact
    Register-Mock Find-VstsFiles { $newPkgPath } -- -LegacyPattern $newPkgPath -IncludeDirectories
    Register-Mock Assert-VstsPath
    Register-Mock Get-VstsBuild { $oldDropLocation }
    $global:LoggedWarningLines = @()
    Register-Mock Write-Warning { $global:LoggedWarningLines += ,([string]$args[0]) }
    Register-Mock Write-Host

    # Act
    Update-ApplicationVersions

    # Assert
    Assert-IsNotNullOrEmpty $global:LoggedWarningLines 'No warning was captured, the assertion would be meaningless.'
    $live = @($global:LoggedWarningLines | Where-Object { $_ -match '##vso\[' -or $_ -match '##\[' })
    Assert-AreEqual -Expected 0 -Actual $live.Count -Message "A captured warning still contains a live logging-command marker: $($live -join ' | ')"
    Assert-AreEqual -Expected 1 -Actual @($global:LoggedWarningLines | Where-Object { $_ -ceq "CouldNotFindSubPath $inertNewPkgPath $oldDropLocation" }).Count -Message "Expected the exact (neutralized) CouldNotFindSubPath message. Captured warnings:`n$($global:LoggedWarningLines -join "`n")"
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $workRoot -ErrorAction SilentlyContinue
}

