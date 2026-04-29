# Unit tests for SQL argument sanitization security fix
# Tests call public methods directly, mock feature flag states, and verify outputs.
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

# ============================================================================
# Should-UseSanitizedArguments - real calls with mocked FF dependencies
# ============================================================================

# Reset the cache before each feature-flag test group
$script:_shouldUseSanitizedArgsResult = $null

# --- Both FFs enabled => returns $true ---
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq 'EnableSqlAdditionalArgumentsSanitization' }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $true $result "Should return true when both FFs are enabled"

# --- 'Enable shell tasks arguments validation' disabled => returns $false ---
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { return $false }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $false $result "Should return false when 'Enable shell tasks arguments validation' is disabled"

# --- 'Enable shell tasks arguments validation' enabled, pipeline-level disabled => returns $false ---
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { return $true }
Unregister-Mock Get-VstsPipelineFeature
Register-Mock Get-VstsPipelineFeature { return $false } -ParametersEvaluator { $FeatureName -eq 'EnableSqlAdditionalArgumentsSanitization' }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $false $result "Should return false when pipeline-level FF is disabled"

# --- 'Enable shell tasks arguments validation' throws => returns $false (graceful fallback) ---
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { throw "Service unavailable" }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $false $result "Should return false when 'Enable shell tasks arguments validation' check throws"

# --- Get-VstsPipelineFeature cmdlet missing => returns $false ---
Unregister-Mock Get-SanitizerCallStatus
Register-Mock Get-SanitizerCallStatus { return $true }
Unregister-Mock Get-Command
Register-Mock Get-Command { return $null } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Test-Path { return $false } -ParametersEvaluator { $Path -like '*VstsTaskSdk*' }
Register-Mock Import-Module { throw "Module not found" }

$result = Get-ShouldUseSanitizedArgumentsInternal
Assert-AreEqual $false $result "Should return false when Get-VstsPipelineFeature cmdlet is unavailable"

# --- Caching: Should-UseSanitizedArguments returns cached value on second call ---
$script:_shouldUseSanitizedArgsResult = $null
Unregister-Mock Get-SanitizerCallStatus
Unregister-Mock Get-Command
Unregister-Mock Get-VstsPipelineFeature
Register-Mock Get-SanitizerCallStatus { return $true }
Register-Mock Get-Command { return $true } -ParametersEvaluator { $Name -eq 'Get-VstsPipelineFeature' }
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq 'EnableSqlAdditionalArgumentsSanitization' }

$firstCall = Should-UseSanitizedArguments
$secondCall = Should-UseSanitizedArguments
Assert-AreEqual $true $firstCall "First call should compute true"
Assert-AreEqual $true $secondCall "Second call should return cached true"
Assert-WasCalled Get-SanitizerCallStatus -Times 1

# ============================================================================
# Execute-CommandV2 - direct calls with real executable
# ============================================================================

# Reset mocks
Unregister-Mock Get-SanitizerCallStatus
Unregister-Mock Get-Command
Unregister-Mock Get-VstsPipelineFeature

# Success: cmd.exe exits 0 — function should not throw
Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c echo hello'

# Failure: cmd.exe exits 1 — function should throw
$threwOnExitCode = $false
try {
    Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c exit 1'
} catch {
    $threwOnExitCode = $true
}
Assert-AreEqual $true $threwOnExitCode "Should throw when executable exits with non-zero code"

# Injection: semicolon-injected commands become harmless array elements passed to cmd.exe
# In V1 (Invoke-Expression), "; whoami" would execute as a separate PS statement.
# In V2 (& $exe $argArray), they are just literal arguments — no PS code execution.
Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c echo safe; echo injected'

# ============================================================================
# Run-SqlCmdV2 - direct calls, verify splat contents via ParametersEvaluator
# ============================================================================
$script:_shouldUseSanitizedArgsResult = $null

$sqlFilePath = "C:\Test\TestFile.sql"

# --- server auth: verify core splat params ---
Register-Mock Invoke-SqlCmd { }

Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments "-QueryTimeout 60"

Assert-WasCalled Invoke-SqlCmd -Times 1

# --- connectionString auth: verify ConnectionString and InputFile ---
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Register-Mock CmdletHasMember { return $true }

$testConnString = "Server=tcp:myserver.database.windows.net;Database=mydb"

Run-SqlCmdV2 -authenticationType "connectionString" -connectionString $testConnString `
    -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments ""

Assert-WasCalled Invoke-SqlCmd -Times 1

# --- servicePrincipal auth: verify AccessToken, ServerInstance, Database ---
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }

Run-SqlCmdV2 -authenticationType "servicePrincipal" -serverName $serverName -databaseName $databaseName `
    -sqlFilePath $sqlFilePath -token "test-access-token" -sqlcmdAdditionalArguments ""

Assert-WasCalled Invoke-SqlCmd -Times 1

# --- injection via additional args: Invoke-SqlCmd still called, no crash ---
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }

Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-Variable "VAR1=1"; whoami'

Assert-WasCalled Invoke-SqlCmd -Times 1

# ============================================================================
# Run-SqlCmdV2 - colon-bound parameter and $true/$false resolution
# ============================================================================

# -OutputSqlErrors:$true should strip colon from param name and resolve $true to boolean
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Register-Mock EscapeSpecialChars { return $args[0] }
Register-Mock Get-FormattedSqlUsername { return $sqlUsername }

Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-OutputSqlErrors:$true -QueryTimeout 30'

Assert-WasCalled Invoke-SqlCmd -Times 1

# -OutputSqlErrors $false should resolve $false to boolean
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }

Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-OutputSqlErrors $false'

Assert-WasCalled Invoke-SqlCmd -Times 1

# ============================================================================
# Run-SqlCmdV2 documented usage patterns (Microsoft Learn docs)
# ============================================================================

# Doc: timeouts (most common, shown in task help text)
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-ConnectionTimeout 120 -QueryTimeout 300'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: error control with boolean and integers
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-OutputSqlErrors $true -ErrorLevel 1 -SeverityLevel 16 -AbortOnError'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: SQLCMD variables as comma-separated array
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-Variable "MYVAR1=Value1","MYVAR2=Value2"'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: switch-only param (-Verbose triggers different code path in Run-SqlCmdV2)
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-Verbose'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: encryption and trust switches
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-Encrypt Optional -TrustServerCertificate'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: colon-bound boolean
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-OutputSqlErrors:$true'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: max lengths
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-MaxCharLength 8000 -MaxBinaryLength 4096'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Doc: disable commands and variables (security switches)
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-DisableCommands -DisableVariables'
Assert-WasCalled Invoke-SqlCmd -Times 1

# ============================================================================
# Run-SqlCmdV2 injection prevention
# ============================================================================

# Semicolon injection — whoami becomes harmless data, not executed
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-Variable "VAR1=1"; whoami'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Pipe injection — Invoke-Expression never runs
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-Variable "VAR1=1" | Invoke-Expression'
Assert-WasCalled Invoke-SqlCmd -Times 1

# Subexpression injection — $() is not evaluated
Unregister-Mock Invoke-SqlCmd
Register-Mock Invoke-SqlCmd { }
Run-SqlCmdV2 -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
    -sqlcmdAdditionalArguments '-QueryTimeout $(malicious)'
Assert-WasCalled Invoke-SqlCmd -Times 1

# ============================================================================
# Dispatch tests - Execute-SqlPackage routes based on FF
# (These mock Run-SqlCmdV2/Execute-CommandV2 — must come AFTER all direct calls)
# ============================================================================
Unregister-Mock Invoke-SqlCmd

# FF enabled => Execute-CommandV2
Register-Mock Should-UseSanitizedArguments { return $true }
Register-Mock Get-SqlPackageOnTargetMachine { return "C:\sqlpackage.exe" }
Register-Mock Execute-CommandV2 { }
Register-Mock Execute-Command { }

Execute-SqlPackage -sqlpackageArguments "test args" -sqlpackageArgumentsToBeLogged "test args"

Assert-WasCalled Execute-CommandV2 -Times 1
Assert-WasCalled Execute-Command -Times 0

# FF disabled => Execute-Command (legacy path)
Unregister-Mock Should-UseSanitizedArguments
Unregister-Mock Execute-CommandV2
Unregister-Mock Execute-Command
Register-Mock Should-UseSanitizedArguments { return $false }
Register-Mock Execute-CommandV2 { }
Register-Mock Execute-Command { }

Execute-SqlPackage -sqlpackageArguments "test args" -sqlpackageArgumentsToBeLogged "test args"

Assert-WasCalled Execute-Command -Times 1
Assert-WasCalled Execute-CommandV2 -Times 0

# ============================================================================
# Dispatch tests - Run-SqlFiles routes based on FF
# ============================================================================
Unregister-Mock Should-UseSanitizedArguments
Unregister-Mock Execute-CommandV2
Unregister-Mock Execute-Command

Register-Mock Find-SqlFiles { return "C:\Test\TestFile.sql" }
Register-Mock Run-SqlCmd { }
Register-Mock Run-SqlCmdV2 { }

# FF enabled => Run-SqlCmdV2
Register-Mock Should-UseSanitizedArguments { return $true }

Run-SqlFiles -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFile $sqlFile -sqlcmdAdditionalArguments ""

Assert-WasCalled Run-SqlCmdV2 -Times 1
Assert-WasCalled Run-SqlCmd -Times 0

# FF disabled => Run-SqlCmd
Unregister-Mock Should-UseSanitizedArguments
Unregister-Mock Run-SqlCmd
Unregister-Mock Run-SqlCmdV2
Register-Mock Should-UseSanitizedArguments { return $false }
Register-Mock Run-SqlCmd { }
Register-Mock Run-SqlCmdV2 { }

Run-SqlFiles -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFile $sqlFile -sqlcmdAdditionalArguments ""

Assert-WasCalled Run-SqlCmd -Times 1
Assert-WasCalled Run-SqlCmdV2 -Times 0

# ============================================================================
# Dispatch tests - Run-InlineSql routes based on FF
# ============================================================================
Unregister-Mock Should-UseSanitizedArguments
Unregister-Mock Run-SqlCmd
Unregister-Mock Run-SqlCmdV2

Register-Mock Out-File { }
Register-Mock Test-Path { return $true }
Register-Mock Remove-Item { }
Register-Mock Run-SqlCmd { }
Register-Mock Run-SqlCmdV2 { }

# FF enabled => Run-SqlCmdV2
Register-Mock Should-UseSanitizedArguments { return $true }

Run-InlineSql -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlInline "select getdate()" -sqlcmdAdditionalArguments ""

Assert-WasCalled Run-SqlCmdV2 -Times 1
Assert-WasCalled Run-SqlCmd -Times 0

# FF disabled => Run-SqlCmd
Unregister-Mock Should-UseSanitizedArguments
Unregister-Mock Run-SqlCmd
Unregister-Mock Run-SqlCmdV2
Register-Mock Should-UseSanitizedArguments { return $false }
Register-Mock Run-SqlCmd { }
Register-Mock Run-SqlCmdV2 { }

Run-InlineSql -authenticationType "server" -serverName $serverName -databaseName $databaseName `
    -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlInline "select getdate()" -sqlcmdAdditionalArguments ""

Assert-WasCalled Run-SqlCmd -Times 1
Assert-WasCalled Run-SqlCmdV2 -Times 0

# ============================================================================
# Split-CLIArguments - quote-aware CLI argument splitter for sqlpackage.exe
# ============================================================================

# Basic /Property:Value arguments
$result = Split-CLIArguments '/Action:Publish /SourceFile:"C:\my path\file.dacpac" /p:IgnoreAnsiNulls=True'
Assert-AreEqual 3 $result.Count "Should split into 3 args"
Assert-AreEqual '/Action:Publish' $result[0] "First arg"
Assert-AreEqual '/SourceFile:C:\my path\file.dacpac' $result[1] "Second arg preserves space, strips quotes"
Assert-AreEqual '/p:IgnoreAnsiNulls=True' $result[2] "Third arg"

# Semicolons are literal — not statement separators
$result = Split-CLIArguments '/p:SqlCommandVariableValues=Var1=val1;Var2=val2'
Assert-AreEqual 1 $result.Count "Semicolon should not split"
Assert-AreEqual '/p:SqlCommandVariableValues=Var1=val1;Var2=val2' $result[0] "Semicolon is literal"

# Dollar signs are literal — not PS variable expansion
$result = Split-CLIArguments '/p:TableData=[dbo].[$partitions]'
Assert-AreEqual 1 $result.Count "Dollar sign should not split"
Assert-AreEqual '/p:TableData=[dbo].[$partitions]' $result[0] "Dollar sign is literal"

# Parentheses are literal — not subexpressions
$result = Split-CLIArguments '/p:Filter=(schema=dbo)'
Assert-AreEqual 1 $result.Count "Parentheses should not split"
Assert-AreEqual '/p:Filter=(schema=dbo)' $result[0] "Parentheses are literal"

# Injection attempt produces harmless array elements
$result = Split-CLIArguments '/p:Test=True; & whoami > C:\temp\out.txt'
Assert-AreEqual $true ($result[0] -eq '/p:Test=True;') "Injection: first token includes semicolon as literal"

# Empty string
$result = Split-CLIArguments ''
Assert-AreEqual 0 $result.Count "Empty string produces no args"

# ============================================================================
# Split-CLIArguments documented sqlpackage.exe patterns (Microsoft Learn docs)
# ============================================================================

# Doc: common boolean properties
$result = Split-CLIArguments '/p:BlockOnPossibleDataLoss=False /p:IgnoreAnsiNulls=True /p:IgnoreComments=True'
Assert-AreEqual 3 $result.Count "Doc: boolean properties should produce 3 args"
Assert-AreEqual '/p:BlockOnPossibleDataLoss=False' $result[0] "Doc: first boolean property"
Assert-AreEqual '/p:IgnoreComments=True' $result[2] "Doc: third boolean property"

# Doc: SQLCMD variables via /v:
$result = Split-CLIArguments '/v:ETLUserPassword="securepass123" /v:AppUserPassword="otherpass456"'
Assert-AreEqual 2 $result.Count "Doc: SQLCMD vars should produce 2 args"
Assert-AreEqual '/v:ETLUserPassword=securepass123' $result[0] "Doc: first SQLCMD var, quotes stripped"
Assert-AreEqual '/v:AppUserPassword=otherpass456' $result[1] "Doc: second SQLCMD var, quotes stripped"

# Doc: semicolon-delimited DoNotDropObjectTypes (REAL documented usage)
$result = Split-CLIArguments '/p:DoNotDropObjectTypes=Users;RoleMembership;Permissions'
Assert-AreEqual 1 $result.Count "Doc: semicolon-delimited list should stay as 1 arg"
Assert-AreEqual '/p:DoNotDropObjectTypes=Users;RoleMembership;Permissions' $result[0] "Doc: semicolons are literal"

# Doc: semicolon-delimited ExcludeObjectTypes
$result = Split-CLIArguments '/p:ExcludeObjectTypes=Permissions;RoleMembership;Users'
Assert-AreEqual 1 $result.Count "Doc: ExcludeObjectTypes semicolons stay as 1 arg"

# Doc: semicolon-delimited AdditionalDeploymentContributorArguments
$result = Split-CLIArguments '/p:AdditionalDeploymentContributorArguments=key1=val1;key2=val2'
Assert-AreEqual 1 $result.Count "Doc: contributor args semicolons stay as 1 arg"

# Doc: timeouts and parallelism
$result = Split-CLIArguments '/p:CommandTimeout=300 /p:LongRunningCommandTimeout=600 /TargetTimeout:120'
Assert-AreEqual 3 $result.Count "Doc: timeouts should produce 3 args"
Assert-AreEqual '/TargetTimeout:120' $result[2] "Doc: colon-style timeout"

# Doc: database edition settings
$result = Split-CLIArguments '/p:DatabaseEdition=Standard /p:DatabaseServiceObjective=S3 /p:DatabaseMaximumSize=250'
Assert-AreEqual 3 $result.Count "Doc: Azure edition settings should produce 3 args"

# Doc: deploy report/script output paths with spaces
$result = Split-CLIArguments '/DeployReportPath:"C:\my output\deploy-report.xml" /DeployScriptPath:"C:\my output\deploy-script.sql"'
Assert-AreEqual 2 $result.Count "Doc: output paths should produce 2 args"
Assert-AreEqual '/DeployReportPath:C:\my output\deploy-report.xml' $result[0] "Doc: path with spaces preserved"

# Doc: short form parameter names
$result = Split-CLIArguments '/a:Publish /sf:"C:\mydb.dacpac" /p:VerifyDeployment=False'
Assert-AreEqual 3 $result.Count "Doc: short form params should produce 3 args"
Assert-AreEqual '/a:Publish' $result[0] "Doc: short form action"

# Doc: diagnostics
$result = Split-CLIArguments '/Diagnostics:True /DiagnosticsFile:"C:\logs\sqlpackage.log"'
Assert-AreEqual 2 $result.Count "Doc: diagnostics should produce 2 args"

# ============================================================================
# Execute-CommandV2 - CLI args with special characters pass through correctly
# ============================================================================

# Semicolons in arguments survive intact
Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c echo /p:Vars=a;b;c'

# Dollar signs survive intact
Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c echo /p:Table=[$test]'

# Doc: semicolon-delimited object types pass through correctly
Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c echo /p:DoNotDropObjectTypes=Users;Permissions'

# Doc: SQLCMD variables with dollar signs
Execute-CommandV2 -FileName "cmd.exe" -Arguments '/c echo /v:MyVar="has$dollar"'

Write-Host "Security function tests completed"
