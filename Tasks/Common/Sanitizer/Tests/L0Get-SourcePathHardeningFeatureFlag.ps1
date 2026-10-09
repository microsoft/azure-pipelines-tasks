[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# --- Case 1: Get-VstsPipelineFeature already available -------------------
# The common/expected case: the cmdlet is present (current agent), so the
# function should call it directly and return whatever it returns.
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    return $true
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $true -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue

# --- Case 2: Get-VstsPipelineFeature missing, VstsTaskSdk import succeeds -
# Simulate an older agent that lacks the cmdlet before Import-Module runs,
# but where re-importing VstsTaskSdk (real or mocked) makes it available.
function global:Import-Module {
    param($Name, $ErrorAction)
    function global:Get-VstsPipelineFeature {
        param([string]$FeatureName)
        return $false
    }
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue
Remove-Item -Path function:Import-Module -ErrorAction SilentlyContinue

# --- Case 3: Get-VstsPipelineFeature missing and stays missing -----------
# Neither the cmdlet nor a successful re-import is available; the function
# must fall back to $false (disabled) rather than throwing.
function global:Import-Module {
    param($Name, $ErrorAction)
    throw "module not found"
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Import-Module -ErrorAction SilentlyContinue

# --- Case 4: Get-VstsPipelineFeature available but throws ---------------
# The feature-flag check itself can fail (e.g. transient server error); the
# function must catch that and fall back to $false rather than propagating.
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    throw "feature flag check failed"
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue
