[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\ArgsParser.ps1

$inputLine = '`` 2'
$expected = @('`', '2')

# Act.
$actual, $telemetry = Parse-FileArguments -InputArgs $inputLine

Assert-AreEqual -Expected $expected -Actual $actual
