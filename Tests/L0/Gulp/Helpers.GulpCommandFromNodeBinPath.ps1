[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
$distributedTaskContext = 'Some distributed task context'
Register-Stub Get-Command
Register-Mock Get-TaskVariable { 'c:\some build sources directory' } -- -Context $distributedTaskContext -Name 'Build.SourcesDirectory'
Register-Mock Test-Path { $true } -- -LiteralPath 'c:\some build sources directory\node_modules\.bin\gulp.cmd' -PathType 'Leaf'
Register-Mock Get-Command { 'Some node bin gulp command' } -- -Name 'c:\some build sources directory\node_modules\.bin\gulp.cmd'

# Act.
$actual = Get-GulpCommand

# Assert.
Assert-AreEqual -Expected 'Some node bin gulp command' -Actual $actual
