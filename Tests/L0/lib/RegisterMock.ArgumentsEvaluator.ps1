[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand -Func { 'Expected value' } -ArgumentsEvaluator {
        $args.Length -eq 4 -and
        $args[0] -eq '-Param1' -and
        $args[1] -eq 'Value1' -and
        $args[2] -eq '-Param2' -and
        $args[3] -eq 'Value2'
    }

# Act.
$actual = Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Assert.
Assert-AreEqual 'Expected value' $actual
