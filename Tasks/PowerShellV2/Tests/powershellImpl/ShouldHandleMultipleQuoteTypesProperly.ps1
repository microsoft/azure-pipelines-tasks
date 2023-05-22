[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\ArgsParser.ps1

$inputLine = '1 ''2 "nested"'''
$expected = @('1', '2 "nested"')

# Act.
$actual, $telemetry = Parse-FileArguments -InputArgs $inputLine

Assert-AreEqual -Expected $expected -Actual $actual
