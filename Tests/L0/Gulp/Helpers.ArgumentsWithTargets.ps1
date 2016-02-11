[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1

# Act.
$actual = Format-ArgumentsParameter -GulpFile 'Some gulp file' -Arguments 'Some arguments' -Targets 'Some targets'

# Assert.
Assert-AreEqual -Expected 'Some targets --gulpfile "Some gulp file" Some arguments' -Actual $actual
