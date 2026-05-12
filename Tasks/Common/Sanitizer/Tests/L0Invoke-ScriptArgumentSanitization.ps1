# Unit tests for Invoke-ScriptArgumentSanitization dispatcher (added by MSRC 115118 / PR #22163).
#
# Mirrors the precedent set by Tasks/SqlAzureDacpacDeploymentV1/Tests/L0SecurityFunctions.ps1
# (PR #21947): each scenario configures Register-Mock for Get-SanitizerCallStatus,
# Get-Command (for the Get-VstsPipelineFeature presence check), Get-VstsPipelineFeature,
# and Protect-ScriptArguments, then drives the dispatcher and asserts.
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Invoke-ScriptArgumentSanitization.ps1

$taskName     = 'AzurePowerShellV5'
$pipelineFlag = 'EnableAzurePowerShellArgumentsSanitization'
$cleanArgs    = '-Param1 value1 -Param2 value2'
$dirtyArgs    = 'test; whoami'

function Reset-AllMocks {
    foreach ($name in @('Get-SanitizerCallStatus','Get-Command','Get-VstsPipelineFeature','Protect-ScriptArguments','Write-Host')) {
        Unregister-Mock $name -ErrorAction SilentlyContinue
    }
}

# ============================================================================
# Test-ShouldUseSanitizer - gating logic
# ============================================================================

# --- Org-level FF off => returns $false (and no pipeline FF query happens) ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true }

$result = Test-ShouldUseSanitizer -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-AreEqual $false $result "Org-level FF off should short-circuit to false"
Assert-WasCalled Get-VstsPipelineFeature -Times 0

# --- Org on, pipeline FF off => returns $false ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $false } -ParametersEvaluator { $FeatureName -eq $pipelineFlag }

$result = Test-ShouldUseSanitizer -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-AreEqual $false $result "Pipeline FF off should yield false"

# --- Org on, pipeline FF on => returns $true ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq $pipelineFlag }

$result = Test-ShouldUseSanitizer -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-AreEqual $true $result "Both FFs on should yield true"

# --- Org-level check throws => returns $false (graceful fallback) ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { throw "Service unavailable" }

$result = Test-ShouldUseSanitizer -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-AreEqual $false $result "Org-level check throw should fall open to false"

# --- Get-VstsPipelineFeature cmdlet missing => returns $false, emits cmdletMissing telemetry ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $null } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }

$result = Test-ShouldUseSanitizer -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-AreEqual $false $result "Missing Get-VstsPipelineFeature cmdlet should yield false"

# --- Pipeline-level FF query throws => returns $false ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { throw "Feature service down" }

$result = Test-ShouldUseSanitizer -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-AreEqual $false $result "Pipeline FF query throw should fall open to false"

# ============================================================================
# Invoke-ScriptArgumentSanitization - dispatch behavior
# ============================================================================

# --- Gates off => Protect-ScriptArguments never called ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Protect-ScriptArguments { return $args[0] }

Invoke-ScriptArgumentSanitization -InputArgs $dirtyArgs -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-WasCalled Protect-ScriptArguments -Times 0

# --- Gates on + clean args => Protect-ScriptArguments called once, no throw ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq $pipelineFlag }
Register-Mock Protect-ScriptArguments { return '' }

Invoke-ScriptArgumentSanitization -InputArgs $cleanArgs -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-WasCalled Protect-ScriptArguments -Times 1

# --- Gates on + dirty args => Protect-ScriptArguments throws 'ScriptArgsSanitized' => re-thrown verbatim ---
# Initialize-Test.ps1 mocks Get-VstsLocString to return the key, so the localized message is 'ScriptArgsSanitized'.
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq $pipelineFlag }
Register-Mock Protect-ScriptArguments { throw 'ScriptArgsSanitized' }

Assert-Throws {
    Invoke-ScriptArgumentSanitization -InputArgs $dirtyArgs -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
} -MessagePattern 'ScriptArgsSanitized'

# --- Gates on + Protect-ScriptArguments throws unexpected error => swallowed (no throw) ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq $pipelineFlag }
Register-Mock Protect-ScriptArguments { throw 'Unexpected internal error' }

try {
    Invoke-ScriptArgumentSanitization -InputArgs $dirtyArgs -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
}
catch {
    throw "Unexpected sanitizer error should have been swallowed into telemetry, but caller saw: $($_.Exception.Message)"
}

# --- Empty input is allowed (parameter has [AllowEmptyString()]) ---
Reset-AllMocks
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq $pipelineFlag }
Register-Mock Protect-ScriptArguments { return $args[0] }

Invoke-ScriptArgumentSanitization -InputArgs '' -TaskName $taskName -PipelineFeatureFlagName $pipelineFlag
Assert-WasCalled Protect-ScriptArguments -Times 1

# ============================================================================
# Publish-SanitizerErrorTelemetry - emits ##vso[telemetry.publish] command
# ============================================================================

Reset-AllMocks

Assert-Output `
    -ScriptBlock { Publish-SanitizerErrorTelemetry -TaskName $taskName -Telemetry @{ checkType = 'OrgLevelFeatureFlag'; checkFailed = $true } } `
    -ExpectedOutput "##vso\[telemetry\.publish area=TaskHub;feature=$taskName\].*checkType.*OrgLevelFeatureFlag.*checkFailed.*true"

Reset-AllMocks
