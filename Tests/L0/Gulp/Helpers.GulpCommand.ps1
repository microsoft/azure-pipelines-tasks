[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
Register-Mock Get-Command { 'Some gulp command' } -- -Name 'gulp' -ErrorAction 'SilentlyContinue'

# Act.
$actual = Get-GulpCommand

# Assert.
Assert-AreEqual -Expected 'Some gulp command' -Actual $actual
