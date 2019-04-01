[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
$directory1 = 'Some drive:\Some directory 1'
$directory2 = 'Some drive:\Some directory 2'
$file1 = "$directory1\Some solution 1"
$file2 = "$directory2\Some solution 2"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Invoke-NuGetRestore { 'Some NuGet output 1' } -- -File $file1
Register-Mock Invoke-NuGetRestore { 'Some NuGet output 2' } -- -File $file2
Register-Mock Invoke-MSBuild { 'Some MSBuild output 1' } -- -ProjectFile $file1 -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -LogFile: "$file1.log"
Register-Mock Invoke-MSBuild { 'Some MSBuild output 2' } -- -ProjectFile $file2 -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -LogFile: "$file2.log"

# Act.
$actual = Invoke-BuildTools -NuGetRestore -SolutionFiles $file1, $file2 -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -Clean -NoTimelineLogger -CreateLogFile

# Assert.
Assert-AreEqual -Expected @(
        'Some NuGet output 1'
        'Some MSBuild output 1'
        'Some NuGet output 2'
        'Some MSBuild output 2'
    ) -Actual $actual
