[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Get-SolutionFiles
Register-Mock EmitTelemetry
Register-Mock Get-VstsInput { '14.0' } -- -Name VSVersion
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
Register-Mock Get-VstsInput { $true } -- -Name EnableDefaultLogger -AsBool
Register-Mock Get-VstsInput { $false } -- -Name isCustomVersion -AsBool
Register-Mock Get-VstsTaskVariable { $false } -- -Name System.Debug -AsBool
Register-Mock Select-VSVersion { 'nosuchversion' } -- -PreferredVersion '14.0'
Register-Mock Select-MSBuildPath
Register-Mock Format-MSBuildArguments

# Act.
Assert-Throws { $null = & $PSScriptRoot\..\VSBuild.ps1 } -MessagePattern "*nosuchversion*"
