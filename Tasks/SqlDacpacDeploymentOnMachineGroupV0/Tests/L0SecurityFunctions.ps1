# Unit tests for SQL argument sanitization security fix
# Tests call public methods directly, mock feature flag states, and verify outputs.
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

# ============================================================================
# Merge-AdditionalSqlArguments - AST Parser splat-merge helper
# ============================================================================

# Key-value parameters
$splat = @{}
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments '-ConnectionTimeout 120 -QueryTimeout 60'
Assert-AreEqual '120' $splat['ConnectionTimeout'] "ConnectionTimeout should be 120"
Assert-AreEqual '60' $splat['QueryTimeout'] "QueryTimeout should be 60"

# Switch parameters (no value)
$splat = @{}
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments '-Verbose -AbortOnError'
Assert-AreEqual $true $splat['Verbose'] "Verbose should be true (switch)"
Assert-AreEqual $true $splat['AbortOnError'] "AbortOnError should be true (switch)"

# Comma-separated -Variable array
$splat = @{}
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments '-Variable "MYVAR1=Value1","MYVAR2=Value2"'
Assert-AreEqual $true $splat.ContainsKey('Variable') "Should have Variable key"
Assert-AreEqual 2 $splat['Variable'].Count "Variable should have 2 values"
Assert-AreEqual 'MYVAR1=Value1' $splat['Variable'][0] "First variable value"
Assert-AreEqual 'MYVAR2=Value2' $splat['Variable'][1] "Second variable value"

# Colon-bound parameter (-OutputSqlErrors:$true)
$splat = @{}
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments '-OutputSqlErrors:$true'
Assert-AreEqual $true $splat.ContainsKey('OutputSqlErrors') "Should have OutputSqlErrors key (colon stripped)"
Assert-AreEqual $true $splat['OutputSqlErrors'] "OutputSqlErrors should be boolean true"

# $false resolution
$splat = @{}
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments '-OutputSqlErrors $false'
Assert-AreEqual $false $splat['OutputSqlErrors'] "OutputSqlErrors should be boolean false"

# Empty/null string — should not modify hashtable
$splat = @{ ServerInstance = 'myserver' }
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments ''
Assert-AreEqual 1 $splat.Count "Empty args should not add keys"
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments $null
Assert-AreEqual 1 $splat.Count "Null args should not add keys"

# Merges into existing hashtable without overwriting unrelated keys
$splat = @{ ServerInstance = 'myserver'; Database = 'mydb' }
Merge-AdditionalSqlArguments -SplatHashtable $splat -AdditionalArguments '-QueryTimeout 60'
Assert-AreEqual 'myserver' $splat['ServerInstance'] "Existing key should be preserved"
Assert-AreEqual '60' $splat['QueryTimeout'] "New key should be added"

# ============================================================================
# Split-CLIArguments - quote-aware CLI argument splitter for sqlpackage.exe
# ============================================================================

# Basic /Property:Value arguments
$result = Split-CLIArguments '/Action:Publish /SourceFile:"C:\my path\file.dacpac" /p:IgnoreAnsiNulls=True'
Assert-AreEqual 3 $result.Count "Should split into 3 args"
Assert-AreEqual '/Action:Publish' $result[0] "First arg"
Assert-AreEqual '/SourceFile:C:\my path\file.dacpac' $result[1] "Spaces preserved, quotes stripped"
Assert-AreEqual '/p:IgnoreAnsiNulls=True' $result[2] "Third arg"

# Semicolons are literal
$result = Split-CLIArguments '/p:DoNotDropObjectTypes=Users;RoleMembership;Permissions'
Assert-AreEqual 1 $result.Count "Semicolon-delimited list stays as 1 arg"
Assert-AreEqual '/p:DoNotDropObjectTypes=Users;RoleMembership;Permissions' $result[0] "Semicolons are literal"

# Dollar signs are literal
$result = Split-CLIArguments '/p:TableData=[dbo].[$partitions]'
Assert-AreEqual 1 $result.Count "Dollar sign should not split"
Assert-AreEqual '/p:TableData=[dbo].[$partitions]' $result[0] "Dollar sign is literal"

# Empty string
$result = Split-CLIArguments ''
Assert-AreEqual 0 $result.Count "Empty string produces no args"

# Injection attempt — semicolons are literal, not PS statement separators
$result = Split-CLIArguments '/p:Test=True; & whoami > C:\temp\out.txt'
Assert-AreEqual $true ($result[0] -eq '/p:Test=True;') "Injection: semicolon is literal"

# ============================================================================
# Should-UseSanitizedArguments - FF state tests
# ============================================================================

$script:_shouldUseSanitizedArgsResult = $null

# Both FFs enabled => true
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq 'EnableSqlAdditionalArgumentsSanitization' }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $true $result "Should return true when both FFs are enabled"

# 'Enable shell tasks arguments validation' disabled => false
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { return $false }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $false $result "Should return false when 'Enable shell tasks arguments validation' is disabled"

# 'Enable shell tasks arguments validation' throws => false (graceful fallback)
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { throw "Service unavailable" }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $false $result "Should return false when FF check throws"

# Caching
$script:_shouldUseSanitizedArgsResult = $null
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { return $true }
Unregister-Mock Get-VstsPipelineFeature
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq 'EnableSqlAdditionalArgumentsSanitization' }

$firstCall = Should-UseSanitizedArguments
$secondCall = Should-UseSanitizedArguments
Assert-AreEqual $true $firstCall "First call should compute true"
Assert-AreEqual $true $secondCall "Second call should return cached true"
Assert-WasCalled Get-SanitizerCallStatus -Times 1

# ============================================================================
# Invoke-DacpacDeploymentV2 — calls CLI executable safely
# ============================================================================

Unregister-Mock Get-SanitizerCallStatus
Unregister-Mock Get-Command
Unregister-Mock Get-VstsPipelineFeature

# Mock the shared module functions that Invoke-DacpacDeploymentV2 calls
Register-Mock Get-SqlPackageOnTargetMachine { return "cmd.exe" }
Register-Mock Get-SqlPackageCmdArgs { return '/c echo /Action:Publish /p:BlockOnPossibleDataLoss=False' }

Invoke-DacpacDeploymentV2 -dacpacFile "test.dacpac" -targetMethod "server" `
    -serverName "localhost" -databaseName "testdb" -authscheme "windowsAuthentication" `
    -additionalArguments '/p:IgnoreAnsiNulls=True'

Assert-WasCalled Get-SqlPackageOnTargetMachine -Times 1
Assert-WasCalled Get-SqlPackageCmdArgs -Times 1

# Semicolons survive through to CLI
Unregister-Mock Get-SqlPackageCmdArgs
Unregister-Mock Get-SqlPackageOnTargetMachine
Register-Mock Get-SqlPackageOnTargetMachine { return "cmd.exe" }
Register-Mock Get-SqlPackageCmdArgs { return '/c echo /p:DoNotDropObjectTypes=Users;Permissions' }

Invoke-DacpacDeploymentV2 -dacpacFile "test.dacpac" -targetMethod "server" `
    -serverName "localhost" -databaseName "testdb" -authscheme "windowsAuthentication" `
    -additionalArguments ''

Assert-WasCalled Get-SqlPackageCmdArgs -Times 1

Write-Host "MachineGroup security function tests completed"
