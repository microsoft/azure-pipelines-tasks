[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
$file = "$directory1\Some solution"
$msBuildLocation = 'Some MSBuild location'
$msBuildArguments = 'Some MSBuild arguments'
Register-Mock Invoke-NuGetRestore { 'Some NuGet output' } -- -File $file
Register-Mock Invoke-MSBuild { 'Some MSBuild clean output' } -- -ProjectFile $file -Targets Clean -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true
Register-Mock Invoke-MSBuild { 'Some MSBuild output' } -- -ProjectFile $file -MSBuildPath $msBuildLocation -AdditionalArguments $msBuildArguments -NoTimelineLogger: $true

# Act.
$actual = Invoke-BuildTools -NuGetRestore -SolutionFiles $file -MSBuildLocation 'Some MSBuild location' -MSBuildArguments 'Some MSBuild arguments' -Clean -NoTimelineLogger

# Assert.
Assert-AreEqual -Expected @(
        'Some NuGet output'
        'Some MSBuild clean output'
        'Some MSBuild output'
    ) -Actual $actual
