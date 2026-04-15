# Tests that dangerous additional arguments are blocked when feature flag is enabled
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

$sqlFilePath = "C:\Test\TestFile.sql"

Register-Mock EscapeSpecialChars { return $sqlPassword }
Register-Mock Get-FormattedSqlUsername { return $sqlUsername }
Register-Mock Invoke-Expression { }

# Enable the feature flag
Register-Mock Get-VstsPipelineFeature { return $true } -ParametersEvaluator { $FeatureName -eq "EnableSqlAdditionalArgumentsSanitization" }

# TEST 1: Semicolon injection should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100; whoami"
} catch {
    $threwException = $true
    Write-Verbose "Caught expected exception: $_"
}
Assert-AreEqual $true $threwException "Semicolon injection should throw"

# TEST 2: Pipe injection should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100 | whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Pipe injection should throw"

# TEST 3: Subexpression injection should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments '-ConnectionTimeout $(whoami)'
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Subexpression injection should throw"

# TEST 4: Ampersand injection should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100 & whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Ampersand injection should throw"

# TEST 5: Backtick injection should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100 ``whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Backtick injection should throw"

# TEST 6: Script block injection should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100 {whoami}"
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Script block injection should throw"

# TEST 7: Array expression should be blocked
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments '-Variable @("var1=val1")'
} catch {
    $threwException = $true
}
Assert-AreEqual $true $threwException "Array expression @() should throw"

# Clean up
