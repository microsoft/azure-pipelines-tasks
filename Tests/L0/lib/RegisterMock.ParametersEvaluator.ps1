[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$expectedParam2 = 'Value2'
Register-Mock Invoke-SomeCommand -Func { 'Expected return value' } -ParametersEvaluator {
        $Param1 -eq 'Value1' -and
        $Param2 -eq $expectedParam2
    }

# Act.
$actualReturnValue = Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Assert.
Assert-AreEqual 'Expected return value' $actualReturnValue
