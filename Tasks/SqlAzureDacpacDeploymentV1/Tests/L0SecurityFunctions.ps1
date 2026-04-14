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
# Dispatch tests - Execute-SqlPackage routes based on FF
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

Write-Host "Security function tests completed"
