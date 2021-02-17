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
$msBuildArguments = 'Some MSBuild with /t:arguments'
Register-Mock Invoke-NuGetRestore { 'NuGet output 1' } -- -File $file1
Register-Mock Invoke-NuGetRestore { 'NuGet output 2' } -- -File $file2
Register-Mock Invoke-MSBuild { 'MSBuild output 1' } -- -ProjectFile $file1 -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$true -LogFile: "$file1.log"
Register-Mock Invoke-MSBuild { 'MSBuild output 2' } -- -ProjectFile $file2 -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$true -LogFile: "$file2.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output 1' } -- -ProjectFile $file1 -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$true -LogFile: "$file1-clean.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output 2' } -- -ProjectFile $file2 -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$true -LogFile: "$file2-clean.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output 1 wrong logfile' } -- -ProjectFile $file1 -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$true -LogFile: "$file1.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output 2 wrong logfile' } -- -ProjectFile $file2 -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$true -LogFile: "$file2.log"

# Act.
$actual = Invoke-BuildTools -NuGetRestore -SolutionFiles $file1, $file2 -MSBuildLocation $msBuildLocation -MSBuildArguments $msBuildArguments -Clean -NoTimelineLogger -CreateLogFile

# Assert.
Assert-AreEqual -Expected @(
        'NuGet output 1'
        'MSBuild clean output 1'
        'NuGet output 2'
        'MSBuild clean output 2'
    ) -Actual $actual
