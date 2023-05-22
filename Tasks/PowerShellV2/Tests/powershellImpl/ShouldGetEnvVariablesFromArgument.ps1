[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\ArgsParser.ps1

$env:VAR1 = 'value1'
$env:VAR2 = 'value2'

$inputLine = '$env:VAR1   $env:VAR2'
$expected = @('value1', 'value2')

# Act.
$actual, $telemetry = Parse-FileArguments -InputArgs $inputLine

Assert-AreEqual -Expected $expected -Actual $actual
