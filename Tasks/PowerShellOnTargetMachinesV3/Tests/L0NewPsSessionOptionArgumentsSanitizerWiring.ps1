[CmdletBinding()]
param()

# MSRC 115118 Bug 1 wiring contract.
#
# Asserts that PowerShellOnTargetMachines.ps1 wires the post-#22171
# Invoke-ScriptArgumentSanitization dispatcher onto $input_NewPsSessionOptionArguments
# with the task-specific TaskName and pipeline feature-flag name. Runtime behavior of
# the dispatcher itself is covered by Tasks/Common/Sanitizer/Tests/L0Invoke-ScriptArgumentSanitization.ps1.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$entryScript = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"
Assert-AreEqual $true (Test-Path $entryScript) "Entry script not found: $entryScript"

$src = Get-Content $entryScript -Raw

# Module must be imported so the dispatcher resolves.
Assert-AreEqual $true ($src -match 'Import-Module\s+\$PSScriptRoot\\ps_modules\\Sanitizer') `
    "Sanitizer module Import-Module statement is missing from PowerShellOnTargetMachines.ps1"

# Sanitizer call must be present.
Assert-AreEqual $true ($src -match 'Invoke-ScriptArgumentSanitization') `
    "Invoke-ScriptArgumentSanitization call is missing from PowerShellOnTargetMachines.ps1"

# Must validate the NewPsSessionOptionArguments input.
Assert-AreEqual $true ($src -match '-InputArgs\s+\$input_NewPsSessionOptionArguments') `
    "Dispatcher must validate `$input_NewPsSessionOptionArguments (the input that flows to the Get-NewPSSessionOption Invoke-Expression sink)"

# Must use the exact task name the dispatcher reports in telemetry.
Assert-AreEqual $true ($src -match "-TaskName\s+'PowerShellOnTargetMachinesV3'") `
    "Dispatcher must use TaskName 'PowerShellOnTargetMachinesV3'"

# Must use the FF name registered server-side (mseng/AzureDevOps companion PR).
Assert-AreEqual $true ($src -match "-PipelineFeatureFlagName\s+'EnablePowerShellOnTargetMachinesArgumentsSanitization'") `
    "Dispatcher must use FF name 'EnablePowerShellOnTargetMachinesArgumentsSanitization' (must match server-side ADO FF registration)"

# Wiring must precede the vulnerable call so the throw aborts the task before the iex.
# Anchor on the call signature (not just the function name) to skip the doc comment above.
$dispatcherPos = $src.IndexOf('Invoke-ScriptArgumentSanitization `')
$sinkCallPos   = $src.IndexOf('Get-NewPSSessionOption -arguments')
Assert-AreEqual $true ($dispatcherPos -gt 0) "Dispatcher call (with backtick continuation) not found"
Assert-AreEqual $true ($sinkCallPos -gt 0) "Get-NewPSSessionOption -arguments call site not found"
Assert-AreEqual $true ($dispatcherPos -lt $sinkCallPos) `
    "Invoke-ScriptArgumentSanitization must run BEFORE Get-NewPSSessionOption -arguments so the throw blocks the Invoke-Expression sink"
