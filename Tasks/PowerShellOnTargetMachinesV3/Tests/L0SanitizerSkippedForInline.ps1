[CmdletBinding()]
param()

# Initialize test framework
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# Source the Utility.ps1 under test
. $PSScriptRoot\..\Utility.ps1

# Mock all Get-VstsInput calls needed by Get-RemoteScriptJobArguments
Register-Mock Get-VstsInput { return "Inline" } -ParametersEvaluator { $Name -eq "ScriptType" }
Register-Mock Get-VstsInput { return "Write-Output 'hello'" } -ParametersEvaluator { $Name -eq "InlineScript" }
Register-Mock Get-VstsInput { return "stop" } -ParametersEvaluator { $Name -eq "ErrorActionPreference" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "failOnStderr" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "ignoreLASTEXITCODE" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "WorkingDirectory" }

# Mock sanitizer - should not be called for inline scripts
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-SanitizerActivateStatus { return $true }
Register-Mock Protect-ScriptArguments { throw "Should not be called for inline scripts" }

# Execute
$result = Get-RemoteScriptJobArguments

# Assert: Protect-ScriptArguments was NOT called (inline scripts don't use ScriptArguments)
Assert-WasCalled Protect-ScriptArguments -Times 0

# Assert: inline flag is set correctly
Assert-AreEqual $true $result.inline "inline should be true for Inline script type"
