# Tests that dangerous additional arguments pass through when feature flag is disabled
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

$serverName = "testserver.database.windows.net"
$databaseName = "TestDatabase"
$appLockName = "TestLock"
$sqlscriptFiles = "C:\Test\script.sql"
$authscheme = "windowsAuthentication"

Register-Mock Import-SqlPs { }
Register-Mock Get-Content { return "SELECT 1" }
Register-Mock Invoke-Expression { }

# Feature flag is NOT set (default off)
Register-Mock Get-VstsPipelineFeature { return $false } -ParametersEvaluator { $FeatureName -eq "EnableSqlAdditionalArgumentsSanitization" }

# TEST 1: Semicolon should pass through when FF is off (old behavior preserved)
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments "-ConnectionTimeout 100; whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Semicolon should NOT throw when FF is disabled"

Assert-WasCalled Invoke-Expression -Times 1
