# Tests for Get-EffectiveOutputPath in SqlAzureActions.ps1
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY = "C:\DefaultWorkingDirectory"

# Mock the feature flag as enabled for most tests
$featureFlags = @{
    enableUserOutputPath = $true
}

# Dot-source only the Get-EffectiveOutputPath function by sourcing the actions file
# but mock the pipeline feature call first
Register-Mock Get-VstsPipelineFeature { return $true }
. $PSScriptRoot\..\SqlAzureActions.ps1

$defaultPath = "C:\DefaultWorkingDirectory\GeneratedOutputFiles\TestDatabase_DriftReport.xml"

# Test 1 - Feature flag OFF: default path is used unchanged
$featureFlags.enableUserOutputPath = $false
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/SomeOtherArg /OutputPath:"C:\Custom\out.xml"'
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Feature flag off: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Feature flag off: ResolvedFilePath should be default"

# Test 2 - Feature flag ON, no /OutputPath in additional args: default path is used
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/SomeOtherArg /AnotherArg:value'
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "No /OutputPath: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "No /OutputPath: ResolvedFilePath should be default"

# Test 3 - Feature flag ON, /OutputPath: with colon syntax (unquoted)
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath:C:\Custom\out.xml'
Assert-AreEqual $null $result.EffectiveOutputPath "Colon unquoted: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\Custom\out.xml' $result.ResolvedFilePath "Colon unquoted: ResolvedFilePath should be user path"

# Test 4 - Feature flag ON, /OutputPath: with colon syntax (quoted path with spaces)
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath:"C:\My Custom Path\out.xml"'
Assert-AreEqual $null $result.EffectiveOutputPath "Colon quoted: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\My Custom Path\out.xml' $result.ResolvedFilePath "Colon quoted: ResolvedFilePath should be user path with spaces"

# Test 5 - Feature flag ON, /OutputPath= with equals syntax (unquoted)
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath=C:\Custom\out.xml'
Assert-AreEqual $null $result.EffectiveOutputPath "Equals unquoted: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\Custom\out.xml' $result.ResolvedFilePath "Equals unquoted: ResolvedFilePath should be user path"

# Test 6 - Feature flag ON, /OutputPath= with equals syntax (quoted)
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath="C:\My Path\out.xml"'
Assert-AreEqual $null $result.EffectiveOutputPath "Equals quoted: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\My Path\out.xml' $result.ResolvedFilePath "Equals quoted: ResolvedFilePath should be user path"

# Test 7 - Feature flag ON, empty /OutputPath:"" should throw
$featureFlags.enableUserOutputPath = $true
Assert-Throws {
    Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath:""'
} -MessagePattern "*User-provided /OutputPath is empty or invalid*"

# Test 8 - Feature flag ON, empty additional arguments: default path used
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments ''
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Empty args: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Empty args: ResolvedFilePath should be default"

# Test 9 - Feature flag ON, null additional arguments: default path used
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments $null
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Null args: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Null args: ResolvedFilePath should be default"

# Test 10 - Feature flag ON, /OutputPath with other args mixed in
$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/TargetTimeout:120 /OutputPath:"D:\Reports\deploy.xml" /Verbose'
Assert-AreEqual $null $result.EffectiveOutputPath "Mixed args: EffectiveOutputPath should be null"
Assert-AreEqual 'D:\Reports\deploy.xml' $result.ResolvedFilePath "Mixed args: ResolvedFilePath should be user path"
