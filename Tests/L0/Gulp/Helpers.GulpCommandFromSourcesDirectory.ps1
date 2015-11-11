[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
$distributedTaskContext = 'Some distributed task context'
Register-Stub Get-Command
Register-Mock Get-TaskVariable { 'c:\some build sources directory' } -- -Context $distributedTaskContext -Name 'Build.SourcesDirectory'
Register-Stub Test-Path
Register-Mock Find-Files { 'c:\some build sources directory\nested directory\gulp.cmd' } -- -SearchPattern 'c:\some build sources directory\**\gulp.cmd'
Register-Mock Get-Command { 'Some sources directory gulp command' } -- -Name 'c:\some build sources directory\nested directory\gulp.cmd'

# Act.
$actual = Get-GulpCommand

# Assert.
Assert-AreEqual -Expected 'Some sources directory gulp command' -Actual $actual
