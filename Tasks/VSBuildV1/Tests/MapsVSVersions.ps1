[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Get-VstsTaskVariable { $false } -- -Name System.Debug -AsBool
Register-Mock Get-SolutionFiles
Register-Mock Format-MSBuildArguments
Register-Mock Invoke-BuildTools
Register-Mock EmitTelemetry
$mappings = @(
    @{ VSVersion = '' ; MSBuildVersion = '14.0' }
    @{ VSVersion = '17.0' ; MSBuildVersion = '17.0' }
    @{ VSVersion = '16.0' ; MSBuildVersion = '16.0' }
    @{ VSVersion = '15.0' ; MSBuildVersion = '15.0' }
    @{ VSVersion = '14.0' ; MSBuildVersion = '14.0' }
    @{ VSVersion = '12.0' ; MSBuildVersion = '12.0' }
    @{ VSVersion = '11.0' ; MSBuildVersion = '4.0' }
    @{ VSVersion = '10.0' ; MSBuildVersion = '4.0' }
)
foreach ($mapping in $mappings) {
    Unregister-Mock Get-VstsInput
    Unregister-Mock Select-VSVersion
    Unregister-Mock Select-MSBuildPath
    Register-Mock Get-VstsInput { $mapping.VSVersion } -- -Name VSVersion
    Register-Mock Get-VstsInput { 'Some input architecture' } -- -Name MSBuildArchitecture
    Register-Mock Get-VstsInput { 'Some input arguments' } -- -Name MSBuildArgs
    Register-Mock Get-VstsInput { 'Some input solution' } -- -Name Solution -Require
    Register-Mock Get-VstsInput { 'Some input platform' } -- -Name Platform
    Register-Mock Get-VstsInput { 'Some input configuration' } -- -Name Configuration
    Register-Mock Get-VstsInput { $false } -- -Name Clean -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name MaximumCpuCount -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name RestoreNuGetPackages -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name LogProjectEvents -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name CreateLogFile -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name EnableDefaultLogger -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name isCustomVersion -AsBool
    Register-Mock Select-VSVersion { $mapping.VSVersion } -- -PreferredVersion $mapping.VSVersion
    Register-Mock Select-MSBuildPath

    # Act.
    $output = & $PSScriptRoot\..\VSBuild.ps1

    # Assert.
    Assert-WasCalled Select-MSBuildPath -- -PreferredVersion $mapping.MSBuildVersion -Architecture 'Some input architecture'
}
