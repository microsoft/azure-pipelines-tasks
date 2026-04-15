# Tests that dangerous additional arguments pass through when feature flag is disabled
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

$sqlFilePath = "C:\Test\TestFile.sql"

Register-Mock EscapeSpecialChars { return $sqlPassword }
Register-Mock Get-FormattedSqlUsername { return $sqlUsername }
Register-Mock Invoke-Expression { }

# Feature flag is NOT set (default off)
Register-Mock Get-VstsPipelineFeature { return $false } -ParametersEvaluator { $FeatureName -eq "EnableSqlAdditionalArgumentsSanitization" }

# TEST 1: Semicolon should pass through when FF is off (old behavior preserved)
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100; whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Semicolon should NOT throw when FF is disabled"

# TEST 2: Pipe should pass through when FF is off
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100 | whoami"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Pipe should NOT throw when FF is disabled"

Assert-WasCalled Invoke-Expression -Times 2
