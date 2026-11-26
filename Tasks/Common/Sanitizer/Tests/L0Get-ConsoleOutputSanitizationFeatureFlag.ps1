[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# --- Case 1: feature flag enabled -----------------------------------------
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    return $true
}

$result = Get-ConsoleOutputSanitizationFeatureFlag
Assert-AreEqual -Expected $true -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue

# --- Case 2: feature flag disabled ----------------------------------------
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    return $false
}

$result = Get-ConsoleOutputSanitizationFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue

# --- Case 3: Get-VstsPipelineFeature throws --------------------------------
# The flag check must never propagate an exception; it must default to
# disabled so a transient server error cannot break the task.
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    throw "feature flag check failed"
}

$result = Get-ConsoleOutputSanitizationFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue
