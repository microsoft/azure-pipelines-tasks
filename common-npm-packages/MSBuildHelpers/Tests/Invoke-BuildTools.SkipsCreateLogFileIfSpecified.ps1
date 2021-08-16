[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
$file = "$directory1\Some solution"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Invoke-NuGetRestore { 'NuGet output' } -- -File $file
Register-Mock Invoke-MSBuild { 'MSBuild clean output' } -- -ProjectFile $file -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true -LogFile: "$file.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output no log' } -- -ProjectFile $file -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true
Register-Mock Invoke-MSBuild { 'MSBuild output no log' } -- -ProjectFile $file -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true
Register-Mock Invoke-MSBuild { 'MSBuild output' } -- -ProjectFile $file -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true -LogFile: "$file.log"

# Act.
$actual = Invoke-BuildTools -NuGetRestore -SolutionFiles $file -MSBuildLocation $msBuildLocation  -MSBuildArguments $msBuildArguments  -Clean -NoTimelineLogger

# Assert.
Assert-AreEqual -Expected @(
        'NuGet output'
        'MSBuild clean output no log'
        'MSBuild output no log'
    ) -Actual $actual
