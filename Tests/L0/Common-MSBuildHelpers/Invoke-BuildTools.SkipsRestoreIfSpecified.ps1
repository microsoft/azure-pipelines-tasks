[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers
$directory = 'Some drive:\Some directory'
$file = "$directory1\Some solution"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Invoke-NuGetRestore
Register-Mock Invoke-MSBuild { 'Some MSBuild clean output' } -- -ProjectFile $file -Targets Clean -LogFile "$file-clean.log" -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true
Register-Mock Invoke-MSBuild { 'Some MSBuild output' } -- -ProjectFile $file -LogFile "$file.log" -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true

# Act.
$actual = Invoke-BuildTools -SolutionFiles $file -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -Clean -NoTimelineLogger

# Assert.
Assert-AreEqual -Expected @(
        'Some MSBuild clean output'
        'Some MSBuild output'
    ) -Actual $actual
Assert-WasCalled Invoke-NuGetRestore -Times 0
