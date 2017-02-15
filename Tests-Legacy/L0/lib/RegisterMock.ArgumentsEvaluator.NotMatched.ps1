[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand -Func { 'Not expected return value' } -ArgumentsEvaluator {
            $args.Length -eq 4 -and
            $args[0] -eq '-Param1' -and
            $args[1] -eq 'Value1' -and
            $args[2] -eq '-Param2' -and
            $args[3] -eq 'Value2'
        }

# Act.
$actual = Invoke-SomeCommand -Param1 Value1 -Param2 'Different parameter value'

# Assert.
Assert-IsNullOrEmpty $actual
