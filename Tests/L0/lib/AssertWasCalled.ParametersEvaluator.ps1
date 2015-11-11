[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Stub Invoke-SomeCommand
Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Act / Assert does not throw.
$expectedParam2 = 'Value2'
Assert-WasCalled Invoke-SomeCommand -ParametersEvaluator {
        $Param1 -eq 'Value1' -and
        $Param2 -eq $expectedParam2
    }
