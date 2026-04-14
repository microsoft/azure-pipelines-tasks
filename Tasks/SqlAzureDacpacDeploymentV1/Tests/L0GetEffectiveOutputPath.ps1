[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY = "C:\DefaultWorkingDirectory"

Register-Mock Get-VstsPipelineFeature { return $true }
. $PSScriptRoot\..\SqlAzureActions.ps1

$defaultPath = "C:\DefaultWorkingDirectory\GeneratedOutputFiles\TestDatabase_DriftReport.xml"

$featureFlags.enableUserOutputPath = $false
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/SomeOtherArg /OutputPath:"C:\Custom\out.xml"'
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Feature flag off: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Feature flag off: ResolvedFilePath should be default"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/SomeOtherArg /AnotherArg:value'
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "No /OutputPath: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "No /OutputPath: ResolvedFilePath should be default"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath:C:\Custom\out.xml'
Assert-AreEqual $null $result.EffectiveOutputPath "Colon unquoted: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\Custom\out.xml' $result.ResolvedFilePath "Colon unquoted: ResolvedFilePath should be user path"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath:"C:\My Custom Path\out.xml"'
Assert-AreEqual $null $result.EffectiveOutputPath "Colon quoted: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\My Custom Path\out.xml' $result.ResolvedFilePath "Colon quoted: ResolvedFilePath should be user path with spaces"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath=C:\Custom\out.xml'
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Equals syntax: EffectiveOutputPath should be default (not detected)"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Equals syntax: ResolvedFilePath should be default (not detected)"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/outputpath:"C:\My Path\out.xml"'
Assert-AreEqual $null $result.EffectiveOutputPath "Case insensitive: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\My Path\out.xml' $result.ResolvedFilePath "Case insensitive: ResolvedFilePath should be user path"

$featureFlags.enableUserOutputPath = $true
Assert-Throws {
    Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath:""'
} -MessagePattern "*User-provided /OutputPath is empty or invalid*"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments ''
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Empty args: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Empty args: ResolvedFilePath should be default"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments $null
Assert-AreEqual $defaultPath $result.EffectiveOutputPath "Null args: EffectiveOutputPath should be default"
Assert-AreEqual $defaultPath $result.ResolvedFilePath "Null args: ResolvedFilePath should be default"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/TargetTimeout:120 /OutputPath:"D:\Reports\deploy.xml" /Verbose'
Assert-AreEqual $null $result.EffectiveOutputPath "Mixed args: EffectiveOutputPath should be null"
Assert-AreEqual 'D:\Reports\deploy.xml' $result.ResolvedFilePath "Mixed args: ResolvedFilePath should be user path"

$featureFlags.enableUserOutputPath = $true
$result = Get-EffectiveOutputPath -defaultOutputPath $defaultPath -additionalArguments '/OutputPath : "C:\Spaced\out.xml"'
Assert-AreEqual $null $result.EffectiveOutputPath "Spaces around colon: EffectiveOutputPath should be null"
Assert-AreEqual 'C:\Spaced\out.xml' $result.ResolvedFilePath "Spaces around colon: ResolvedFilePath should be user path"
