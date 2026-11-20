[CmdletBinding()]
param()

# Regression test for the diff package message that names the version of a service manifest registered on the
# cluster. The version is read back from the cluster, so a logging command in it must never reach the agent as a
# command. The diff package must still be created.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$applicationPackagePath = "$PSScriptRoot\data\DiffPkgAssets\AppPkg"
# New-Item reports a short (8.3) TEMP path, as used on hosted agents, in its long form. The product returns what
# New-Item reports, so the expected paths are derived from the same form. The folder is only created to learn that
# form; it is removed again at once and created by the product.
$tempDirectory = (New-Item -ItemType Directory `
    -Path (Join-Path $env:TEMP "sf-diff-package-injection-$([guid]::NewGuid().ToString('N'))")).FullName
Remove-Item -LiteralPath $tempDirectory -Force -ErrorAction SilentlyContinue
$diffPackagePath = Join-Path $tempDirectory 'DiffPackage'
$applicationName = 'AppName'
$injection = '##vso[task.setvariable variable=INJECTED]x'
$defusedInjection = '##_vso[task.setvariable variable=INJECTED]x'

$global:ClusterServiceManifestVersion = '1.0.0'

function New-ClusterServiceManifest
{
    param([string]$Version)

    '<ServiceManifest Name="Stateless2Pkg" Version="' + $Version + '">' +
    '<ServiceTypes><StatelessServiceType ServiceTypeName="Stateless2Type" /></ServiceTypes>' +
    '<CodePackage Name="Code" Version="1.0.0"></CodePackage>' +
    '<ConfigPackage Name="Config" Version="1.0.0" />' +
    '</ServiceManifest>'
}

# Every copy is mocked. Only the diff package folders are created, under a unique temporary folder that is removed
# at the end.
Register-Mock Get-TempDirectoryPath { $tempDirectory }
Register-Mock Get-ApplicationManifestPath { "$applicationPackagePath\ApplicationManifest.xml" } `
    -- -ApplicationPackagePath $applicationPackagePath
Register-Mock Get-ApplicationManifestPath { "$diffPackagePath\ApplicationManifest.xml" } `
    -- -ApplicationPackagePath $diffPackagePath
Register-Mock Get-ServiceFabricApplicationAction {
    [pscustomobject]@{ ApplicationTypeName = 'TestType'; ApplicationTypeVersion = '1.0.0' }
} -- -ApplicationName $applicationName
Register-Mock Get-ServiceFabricServiceTypeAction {
    @([pscustomobject]@{ ServiceManifestName = 'Stateless2Pkg' })
} -- -ApplicationTypeName 'TestType' -ApplicationTypeVersion '1.0.0'
Register-Mock Get-ServiceFabricServiceManifestAction {
    New-ClusterServiceManifest -Version $global:ClusterServiceManifestVersion
} -- -ApplicationTypeName 'TestType' -ApplicationTypeVersion '1.0.0' -ServiceManifestName 'Stateless2Pkg'
Register-Mock Copy-Item
Register-Mock Write-VstsTaskError
Register-HostCapture

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Create-DiffPackage.psm1"

function New-DiffPackageForCluster
{
    New-DiffPackage `
        -ApplicationName $applicationName `
        -ApplicationPackagePath $applicationPackagePath `
        -ConnectedServiceEndpoint @{ Url = 'tcp://cluster:19000' } `
        -ClusterConnectionParameters @{}
}

try
{
    # Act 1: an ordinary version is written exactly as before and raises no audit event.
    $result = New-DiffPackageForCluster

    Assert-AreEqual $diffPackagePath $result.FullName "The diff package must still be created."
    Assert-LogLineWritten 'DIFFPKG_CreatingDiffPackageForService Stateless2Pkg 1.0.0 2.0.0'
    Assert-NoAuditEventWritten

    # Act 2: a marker in the version registered on the cluster.
    Clear-HostCapture
    $global:ClusterServiceManifestVersion = "1.0.0 $injection"
    $result = New-DiffPackageForCluster

    Assert-AreEqual $diffPackagePath $result.FullName "The diff package must still be created."
    Assert-NoLiveLoggingCommands
    Assert-AuditEventWritten 'task.setvariable' -Count 1
    Assert-LogLineWritten "DIFFPKG_CreatingDiffPackageForService Stateless2Pkg 1.0.0 $defusedInjection 2.0.0"
}
finally
{
    Remove-Item -LiteralPath $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
