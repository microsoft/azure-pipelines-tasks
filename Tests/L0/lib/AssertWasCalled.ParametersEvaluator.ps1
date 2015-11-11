[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Stub Invoke-SomeCommand
Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Act / Assert does not throw.
Assert-WasCalled Invoke-SomeCommand -ParametersEvaluator {
        $Param1 -eq 'Value1' -and
        $Param2 -eq 'Value2'
    }
