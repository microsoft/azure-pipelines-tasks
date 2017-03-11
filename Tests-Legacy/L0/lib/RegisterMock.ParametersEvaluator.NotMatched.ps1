[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand -Func { 'Not expected return value' } -ParametersEvaluator {
        $Param1 -eq 'Value1' -and
        $Param2 -eq 'Value2'
    }

# Act.
$actualReturnValue = Invoke-SomeCommand -Param1 Value1 -Param2 'Different parameter value'

# Assert.
Assert-IsNullOrEmpty $actualReturnValue
