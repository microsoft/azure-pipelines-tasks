[CmdletBinding()]
param()

# Initialize test framework
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# Source the Utility.ps1 under test
. $PSScriptRoot\..\Utility.ps1

# Mock all Get-VstsInput calls needed by Get-RemoteScriptJobArguments
Register-Mock Get-VstsInput { return "FilePath" } -ParametersEvaluator { $Name -eq "ScriptType" }
Register-Mock Get-VstsInput { return "C:\scripts\deploy.ps1" } -ParametersEvaluator { $Name -eq "ScriptPath" }
Register-Mock Get-VstsInput { return "-Param1 Value; whoami" } -ParametersEvaluator { $Name -eq "ScriptArguments" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "InitializationScript" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "SessionVariables" }
Register-Mock Get-VstsInput { return "stop" } -ParametersEvaluator { $Name -eq "ErrorActionPreference" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "failOnStderr" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "ignoreLASTEXITCODE" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "WorkingDirectory" }

# Mock sanitizer: feature flags OFF
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }
Register-Mock Protect-ScriptArguments { throw "Should not be called" }

# Execute
$result = Get-RemoteScriptJobArguments

# Assert: Protect-ScriptArguments was NOT called
Assert-WasCalled Protect-ScriptArguments -Times 0

# Assert: scriptArguments should be the original unsanitized value
Assert-AreEqual "-Param1 Value; whoami" $result.scriptArguments "scriptArguments should remain unchanged when feature flags are off"
