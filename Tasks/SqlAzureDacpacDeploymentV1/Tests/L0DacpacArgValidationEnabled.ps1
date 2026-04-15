# Tests that dangerous sqlpackage additional arguments are blocked when feature flag is enabled.
# Uses pipe injection as the key test case because --% (stop-parsing) does NOT block
# pipe operators — this is the critical vulnerability in the sqlpackage.exe / Execute-Command path.
# The Assert-AdditionalArguments function is shared between SqlCmd and SqlPackage paths;
# pattern coverage is tested in L0SqlCmdArgValidationEnabled.ps1, so here we verify:
# 1. The function works with the "SqlPackage.exe" context
# 2. Key bypass vectors (pipe, ampersand) that --% fails to block are caught
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

# TEST 1: Pipe injection should be blocked (--% does NOT block pipes)
$threwException = $false
try {
    Assert-AdditionalArguments -arguments "/p:BlockOnPossibleDataLoss=false | Out-File C:\hack.txt" -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
    Write-Verbose "Caught expected exception: $_"
}
Assert-AreEqual $true $threwException "Pipe injection in sqlpackage args should throw"

# TEST 2: Ampersand/chain injection should be blocked (--% does NOT block &&)
$threwException = $false
try {
    Assert-AdditionalArguments -arguments "/p:BlockOnPossibleDataLoss=false && whoami" -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Ampersand injection in sqlpackage args should throw"

# TEST 3: Semicolon injection should be blocked
$threwException = $false
try {
    Assert-AdditionalArguments -arguments "/p:BlockOnPossibleDataLoss=false; whoami" -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Semicolon injection in sqlpackage args should throw"

# TEST 4: Subexpression injection should be blocked
$threwException = $false
try {
    Assert-AdditionalArguments -arguments '/p:CommandTimeout=$(whoami)' -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Subexpression injection in sqlpackage args should throw"
