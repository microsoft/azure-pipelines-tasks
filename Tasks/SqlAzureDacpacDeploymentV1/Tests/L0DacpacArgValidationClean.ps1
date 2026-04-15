# Tests that legitimate sqlpackage additional arguments pass through when feature flag is enabled
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

# TEST 1: Standard sqlpackage property arguments should pass
$threwException = $false
try {
    Assert-AdditionalArguments -arguments '/p:BlockOnPossibleDataLoss=false /p:IgnoreAnsiNulls=True' -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Standard sqlpackage properties should not throw"

# TEST 2: Timeout and variable arguments should pass
$threwException = $false
try {
    Assert-AdditionalArguments -arguments '/p:CommandTimeout=120 /v:SchemaName="dbo"' -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Timeout and variable args should not throw"

# TEST 3: Empty additional arguments should pass
$threwException = $false
try {
    Assert-AdditionalArguments -arguments '' -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Empty args should not throw"

# TEST 4: Arguments with paths and quotes should pass
$threwException = $false
try {
    Assert-AdditionalArguments -arguments '/SourceFile:"C:\My Files\db.dacpac" /p:DropObjectsNotInSource=true' -context "Additional SqlPackage.exe"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Quoted paths should not throw"
