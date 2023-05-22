[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\ArgsParser.ps1

$inputLine = "one two\arg     three"
$expected = @('one', 'two\arg', 'three')

# Act.
$actual, $telemetry = Parse-FileArguments -InputArgs $inputLine

Assert-AreEqual -Expected $expected -Actual $actual
