# Tests that legitimate additional arguments pass through when feature flag is enabled
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

# TEST 1: Standard documented arguments should pass
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-ConnectionTimeout 100 -OutputSqlErrors"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Standard args should pass validation"

# TEST 2: QueryTimeout argument should pass
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-QueryTimeout 300"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "QueryTimeout arg should pass validation"

# TEST 3: Variable with comma-separated values (alternative to @()) should pass
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments '-Variable "var1=value1", "var2=value2"'
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Comma-separated Variable args should pass validation"

# TEST 4: Verbose flag should pass
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments "-Verbose"
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Verbose flag should pass validation"

# TEST 5: Empty arguments should pass
$threwException = $false
try {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName `
        -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath `
        -sqlcmdAdditionalArguments ""
} catch {
    $threwException = $true
}
Assert-AreEqual $false $threwException "Empty args should pass validation"

Assert-WasCalled Invoke-Expression -Times 5

# Clean up
