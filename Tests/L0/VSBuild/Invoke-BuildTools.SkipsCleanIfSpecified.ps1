[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
$env:NUGET_EXTENSIONS_PATH = $null
$directory = 'Some drive:\Some directory'
$file = "$directory1\Some solution"
$nuGetPath = 'Some path to NuGet.exe'
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Get-ToolPath { $nuGetPath } -- -Name 'NuGet.exe'
Register-Mock Invoke-Tool
Register-Mock Invoke-MSBuild

# Act.
Invoke-BuildTools -NuGetRestore -SolutionFiles $file -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -NoTimelineLogger

# Assert.
Assert-WasCalled Invoke-MSBuild -Times 1 # Should only be called exactly once.
