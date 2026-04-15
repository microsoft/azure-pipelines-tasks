# Tests that legitimate additional arguments pass through when feature flag is enabled
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

# Enable the feature flag
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq "EnableSqlAdditionalArgumentsSanitization" }

# TEST 1: Standard documented arguments should pass
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments "-ConnectionTimeout 100 -OutputSqlErrors"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Standard args should pass validation"

# TEST 2: Empty arguments should pass
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments ""
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Empty args should pass validation"

Assert-WasCalled Invoke-Expression -Times 2
