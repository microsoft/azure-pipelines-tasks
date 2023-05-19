[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\ArgsParser.ps1

[System.Environment]::SetEnvironmentVariable('VAR1', '1 2')
[System.Environment]::SetEnvironmentVariable('VAR2', '3 4')

$inputLine = '$env:VAR1 $env:VAR2'
$expected = @('1 2', '3 4')

# Act.
$actual, $telemetry = Parse-FileArguments -InputArgs $inputLine

Assert-AreEqual -Expected $expected -Actual $actual
