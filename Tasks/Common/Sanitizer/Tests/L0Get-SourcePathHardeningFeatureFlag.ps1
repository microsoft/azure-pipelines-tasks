[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# --- Case 1: enabled ---------------------------------------------------------
# Get-VstsPipelineFeature (the real SDK cmdlet) returns $true.
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    return $true
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $true -Actual $result

# --- Case 2: disabled --------------------------------------------------------
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    return $false
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue

# --- Case 3: lookup failure --------------------------------------------------
# The feature-flag check itself can fail (e.g. transient server error); the
# function must catch that and fall back to $false rather than propagating.
function global:Get-VstsPipelineFeature {
    param([string]$FeatureName)
    throw "feature flag check failed"
}

$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $false -Actual $result

Remove-Item -Path function:Get-VstsPipelineFeature -ErrorAction SilentlyContinue

# --- Case 4: cmdlet missing ---------------------------------------------------
# If Get-VstsPipelineFeature is not available (e.g. a very old agent that predates
# the cmdlet), the call must still be caught and default to $false rather than
# throwing a command-not-found error out of the task.
$result = Get-SourcePathHardeningFeatureFlag
Assert-AreEqual -Expected $false -Actual $result
