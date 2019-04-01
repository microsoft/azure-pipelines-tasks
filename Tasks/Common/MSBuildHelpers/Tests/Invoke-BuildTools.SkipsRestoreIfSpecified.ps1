[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
$file = "$directory1\Some solution"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Invoke-NuGetRestore
Register-Mock Invoke-MSBuild { 'Some MSBuild output' } -- -ProjectFile $file -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true -LogFile: "$file.log"

# Act.
$actual = Invoke-BuildTools -SolutionFiles $file -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -Clean -NoTimelineLogger -CreateLogFile

# Assert.
Assert-AreEqual -Expected 'Some MSBuild output' -Actual $actual
Assert-WasCalled Invoke-NuGetRestore -Times 0
