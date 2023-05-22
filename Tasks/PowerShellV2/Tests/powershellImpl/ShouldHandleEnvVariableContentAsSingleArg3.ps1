[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\ArgsParser.ps1

[System.Environment]::SetEnvironmentVariable('VAR1', '2 3 4')

$inputLine = '1 $env:VAR1 "5 6"'
$expected = @('1', '2 3 4', '5 6')

# Act.
$actual, $telemetry = Parse-FileArguments -InputArgs $inputLine

Assert-AreEqual -Expected $expected -Actual $actual
