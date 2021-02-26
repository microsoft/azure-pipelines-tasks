[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
$file = "$directory1\Some solution"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Invoke-NuGetRestore
Register-Mock Invoke-NuGetRestore { 'NuGet output' } -- -File $file
Register-Mock Invoke-MSBuild { 'MSBuild output' } -- -ProjectFile $file -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true -LogFile: "$file.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output' } -- -ProjectFile $file -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true -LogFile: "$file-clean.log"
Register-Mock Invoke-MSBuild { 'MSBuild clean output wrong logfile' } -- -ProjectFile $file -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -IsDefaultLoggerEnabled: $true -LogFile: "$file.log"

# Act.
$actual = Invoke-BuildTools -SolutionFiles $file -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -Clean -NoTimelineLogger -CreateLogFile

# Assert.
Assert-AreEqual -Expected @(
        'MSBuild clean output'
        'MSBuild output'
    ) -Actual $actual

Assert-WasCalled Invoke-NuGetRestore -Times 0
