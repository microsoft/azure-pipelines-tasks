# Tests that dangerous additional arguments are blocked when feature flag is enabled
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

# TEST 1: Semicolon injection should be blocked
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments "-ConnectionTimeout 100; whoami"
} catch {
    $threwException = $true
    Write-Verbose "Caught expected exception: $_"
}
Assert-AreEqual $true $threwException "Semicolon injection should throw"

# TEST 2: Pipe injection should be blocked
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments "-ConnectionTimeout 100 | whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Pipe injection should throw"

# TEST 3: Subexpression injection should be blocked
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments '-ConnectionTimeout $(whoami)'
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Subexpression injection should throw"

# TEST 4: Ampersand injection should be blocked
$threwException = $false
try {
    Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName `
        -appLockName $appLockName -sqlscriptFiles $sqlscriptFiles `
        -authscheme $authscheme -additionalArguments "-ConnectionTimeout 100 & whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Ampersand injection should throw"

Assert-WasCalled Invoke-Expression -Times 0
