[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
$env:NUGET_EXTENSIONS_PATH = $null
$directory1 = 'Some drive:\Some directory 1'
$directory2 = 'Some drive:\Some directory 2'
$file1 = "$directory1\Some solution 1"
$file2 = "$directory2\Some solution 2"
$nuGetPath = 'Some path to NuGet.exe'
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Get-ToolPath { $nuGetPath } -- -Name 'NuGet.exe'
Register-Mock Invoke-Tool { 'Some NuGet output 1' } -- -Path $nuGetPath -Arguments "restore `"$file1`" -NonInteractive" -WorkingFolder $directory1
Register-Mock Invoke-Tool { 'Some NuGet output 2' } -- -Path $nuGetPath -Arguments "restore `"$file2`" -NonInteractive" -WorkingFolder $directory2
Register-Mock Invoke-MSBuild { 'Some MSBuild clean output 1' } -- $file1 -Targets Clean -LogFile "$file1-clean.log" -ToolLocation $msBuildLocation -CommandLineArgs $msBuildArguments -NoTimelineLogger: $true
Register-Mock Invoke-MSBuild { 'Some MSBuild clean output 2' } -- $file2 -Targets Clean -LogFile "$file2-clean.log" -ToolLocation $msBuildLocation -CommandLineArgs $msBuildArguments -NoTimelineLogger: $true
Register-Mock Invoke-MSBuild { 'Some MSBuild output 1' } -- $file1 -LogFile "$file1.log" -ToolLocation $msBuildLocation -CommandLineArgs $msBuildArguments -NoTimelineLogger: $true
Register-Mock Invoke-MSBuild { 'Some MSBuild output 2' } -- $file2 -LogFile "$file2.log" -ToolLocation $msBuildLocation -CommandLineArgs $msBuildArguments -NoTimelineLogger: $true

# Act.
$actual = Invoke-BuildTools -NuGetRestore -SolutionFiles $file1, $file2 -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -Clean -NoTimelineLogger

# Assert.
Assert-AreEqual -Expected @(
        'Some NuGet output 1'
        'Some MSBuild clean output 1'
        'Some MSBuild output 1'
        'Some NuGet output 2'
        'Some MSBuild clean output 2'
        'Some MSBuild output 2'
    ) -Actual $actual
