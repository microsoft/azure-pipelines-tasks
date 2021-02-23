[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
$directory = 'Some drive:\Some directory'
$file = "$directory\Some solution"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'

Register-Mock Invoke-NuGetRestore { 'NuGet output' } -- -File $file
Register-Mock Invoke-MSBuild { 'MSBuild disabled logger output' } -- -ProjectFile $file -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled:$false -LogFile: "$file.log"

# Act.
$actual = Invoke-BuildTools -NuGetRestore -SolutionFiles $file -MSBuildLocation $msBuildLocation -MSBuildArguments $msBuildArguments -NoTimelineLogger -CreateLogFile -IsDefaultLoggerEnabled:$false
# Assert.
Assert-AreEqual -Expected @(
        'NuGet output'
        'MSBuild disabled logger output'
    ) -Actual $actual


