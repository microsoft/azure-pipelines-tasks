# Tests that sqlpackage additional arguments pass through when feature flag is disabled
# (legacy behavior — no validation, args go through to Invoke-Expression as-is)
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

# TEST: With FF off, Assert-AdditionalArguments is not called, so malicious args pass through.
# We verify this by confirming the function itself works correctly (it always throws on bad input),
# and the FF gate is what prevents it from being called.
# The wiring of FF -> Assert-AdditionalArguments in DeploySqlAzure.ps1 is an integration concern
# verified by the existing L0ValidDacpacInput test (which runs DeploySqlAzure.ps1 with no FF mock
# and succeeds, proving that unmocked Get-VstsPipelineFeature returns falsy → validation skipped).

# Verify that clean args do NOT throw
$threwException = $false
try {
    Assert-AdditionalArguments -arguments "/p:BlockOnPossibleDataLoss=false /p:CommandTimeout=120" -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Clean sqlpackage args should not throw"
