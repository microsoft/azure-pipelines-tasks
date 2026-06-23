[CmdletBinding()]
param()

# MSRC 115118 Bug 2 wiring contract.
#
# Asserts that Publish-AzureCloudDeployment.ps1 wires the post-#22171
# Invoke-ScriptArgumentSanitization dispatcher onto $NewServiceAdditionalArguments
# with the task-specific TaskName and pipeline feature-flag name. Runtime behavior of
# the dispatcher itself is covered by Tasks/Common/Sanitizer/Tests/L0Invoke-ScriptArgumentSanitization.ps1.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$entryScript = "$PSScriptRoot\..\Publish-AzureCloudDeployment.ps1"
Assert-AreEqual $true (Test-Path $entryScript) "Entry script not found: $entryScript"

$src = Get-Content $entryScript -Raw

# Module must be imported so the dispatcher resolves.
Assert-AreEqual $true ($src -match 'Import-Module\s+\$PSScriptRoot\\ps_modules\\Sanitizer') `
    "Sanitizer module Import-Module statement is missing from Publish-AzureCloudDeployment.ps1"

# Sanitizer call must be present.
Assert-AreEqual $true ($src -match 'Invoke-ScriptArgumentSanitization') `
    "Invoke-ScriptArgumentSanitization call is missing from Publish-AzureCloudDeployment.ps1"

# Must validate ALL inputs that flow into the same Invoke-Expression sink (Opus-4.8 review,
# 2026-06-23): the new-service block at line ~85-95 interpolates $ServiceName,
# $ServiceLocation, $NewServiceAffinityGroup AND $NewServiceAdditionalArguments into the
# command string before iex, so all four must be validated.
Assert-AreEqual $true ($src -match '-InputArgs\s+\$ServiceName\b') `
    'Dispatcher must validate $ServiceName (flows into -ServiceName "..." in the iex sink)'
Assert-AreEqual $true ($src -match '-InputArgs\s+\$ServiceLocation\b') `
    'Dispatcher must validate $ServiceLocation (flows into -Location "..." in the iex sink)'
Assert-AreEqual $true ($src -match '-InputArgs\s+\$NewServiceAffinityGroup\b') `
    'Dispatcher must validate $NewServiceAffinityGroup (flows into -AffinityGroup "..." in the iex sink)'
Assert-AreEqual $true ($src -match '-InputArgs\s+\$NewServiceAdditionalArguments\b') `
    'Dispatcher must validate $NewServiceAdditionalArguments (raw-appended into the iex sink)'

# Must use the exact task name the dispatcher reports in telemetry.
Assert-AreEqual $true ($src -match "-TaskName\s+'AzureCloudPowerShellDeploymentV1'") `
    "Dispatcher must use TaskName 'AzureCloudPowerShellDeploymentV1'"

# Must use the FF name registered server-side (mseng/AzureDevOps companion PR).
Assert-AreEqual $true ($src -match "-PipelineFeatureFlagName\s+'EnableAzureCloudPowerShellArgumentsSanitization'") `
    "Dispatcher must use FF name 'EnableAzureCloudPowerShellArgumentsSanitization' (must match server-side ADO FF registration)"

# Wiring must precede the vulnerable sink so the throw aborts the task before the iex.
# Anchor on the exact assignment+iex line in the new-service block (skips the doc comment above).
$dispatcherPos = $src.IndexOf('Invoke-ScriptArgumentSanitization `')
$sinkPos       = $src.IndexOf('$azureService = Invoke-Expression -Command $azureService')
Assert-AreEqual $true ($dispatcherPos -gt 0) "Dispatcher call (with backtick continuation) not found"
Assert-AreEqual $true ($sinkPos -gt 0) "`$azureService = Invoke-Expression -Command `$azureService sink line not found"
Assert-AreEqual $true ($dispatcherPos -lt $sinkPos) `
    "Invoke-ScriptArgumentSanitization must run BEFORE the Invoke-Expression sink so the throw blocks injection"

# Wiring must live INSIDE the if (!$azureService) new-service-creation branch (GPT-5.5 review,
# 2026-06-23). Moving it up to top-of-try means existing-service deployments would also throw
# on the FF-enabled char-list when args like -Description "Prod (EU)" are present, even though
# their iex path is never executed. The dispatcher position must therefore be AFTER the
# `if (!$azureService) {` opening brace.
$branchOpenPos = $src.IndexOf('if (!$azureService)')
Assert-AreEqual $true ($branchOpenPos -gt 0) "if (!`$azureService) branch not found"
Assert-AreEqual $true ($dispatcherPos -gt $branchOpenPos) `
    "Invoke-ScriptArgumentSanitization must run INSIDE the new-service-creation branch (after `if (!`$azureService)`), so existing-service deployments are not gated on inputs the iex would never see"

# Sanitizer module must be bundled into the built task so Import-Module resolves.
# In source tree this is configured in make.json (common: ../Common/Sanitizer); the
# build copies the result into ps_modules\Sanitizer alongside the task. We check the
# build output so the assertion works under both source-tree and _build runners.
$sanitizerModule = "$PSScriptRoot\..\ps_modules\Sanitizer\Invoke-ScriptArgumentSanitization.ps1"
$sanitizerModuleAlt = "$PSScriptRoot\..\..\..\Tasks\Common\Sanitizer\Invoke-ScriptArgumentSanitization.ps1"
$bundled = (Test-Path $sanitizerModule) -or (Test-Path $sanitizerModuleAlt)
Assert-AreEqual $true $bundled `
    "Sanitizer module must be bundled into ps_modules\Sanitizer (set via make.json common: ../Common/Sanitizer) so Import-Module resolves at runtime"
