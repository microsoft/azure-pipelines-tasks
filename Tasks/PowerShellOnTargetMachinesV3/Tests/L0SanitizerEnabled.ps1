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

# Mock sanitizer: feature flags ON
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-SanitizerActivateStatus { return $true }

# Mock Protect-ScriptArguments to return sanitized array (semicolon stripped)
Register-Mock Protect-ScriptArguments { return @("-Param1", "Value_#removed#_", "whoami") } -ParametersEvaluator { $InputArgs -eq "-Param1 Value; whoami" -and $TaskName -eq "PowerShellOnTargetMachinesV3" }

# Execute
$result = Get-RemoteScriptJobArguments

# Assert: Protect-ScriptArguments was called
Assert-WasCalled Protect-ScriptArguments -Times 1

# Assert: scriptArguments should be the sanitized (joined) value, not the original
Assert-AreEqual "-Param1 Value_#removed#_ whoami" $result.scriptArguments "scriptArguments should be sanitized when feature flag is activated"
