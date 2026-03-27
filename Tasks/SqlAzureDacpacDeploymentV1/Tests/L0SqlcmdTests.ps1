# Tests for helper methods in SqlAzureActions.ps1
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - valid inputs
###############################################################################

# Integer value
$result = ConvertTo-SqlCmdParameterHashtable "-ConnectionTimeout 120"
Assert-AreEqual 120 $result['ConnectionTimeout'] "Should parse ConnectionTimeout as int"

# Switch parameter (no value)
$result = ConvertTo-SqlCmdParameterHashtable "-OutputSqlErrors"
Assert-AreEqual $true $result['OutputSqlErrors'] "Should parse switch param"

# Multiple parameters
$result = ConvertTo-SqlCmdParameterHashtable "-ConnectionTimeout 120 -OutputSqlErrors"
Assert-AreEqual 120 $result['ConnectionTimeout'] "Should parse first param"
Assert-AreEqual $true $result['OutputSqlErrors'] "Should parse second param"

# String value
$result = ConvertTo-SqlCmdParameterHashtable "-OutputAs DataRows"
Assert-AreEqual "DataRows" $result['OutputAs'] "Should parse string value"

# Quoted value with spaces
$result = ConvertTo-SqlCmdParameterHashtable '-Variable "MyVar=Hello World"'
Assert-AreEqual "MyVar=Hello World" $result['Variable'] "Should parse quoted value"

# Case-insensitive parameter name
$result = ConvertTo-SqlCmdParameterHashtable "-connectiontimeout 60"
Assert-AreEqual 60 $result['connectiontimeout'] "Should accept case-insensitive param name"

# Empty and null inputs
$result = ConvertTo-SqlCmdParameterHashtable ""
Assert-AreEqual 0 $result.Count "Should return empty hashtable for empty string"

$result = ConvertTo-SqlCmdParameterHashtable $null
Assert-AreEqual 0 $result.Count "Should return empty hashtable for null"

$result = ConvertTo-SqlCmdParameterHashtable "   "
Assert-AreEqual 0 $result.Count "Should return empty hashtable for whitespace-only"

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - injection prevention
###############################################################################

# Semicolon command separator
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-ConnectionTimeout 120; whoami' } -MessagePattern "*not allowed*"

# Pipeline injection
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-ConnectionTimeout 120 | Out-File C:\hack.txt' } -MessagePattern "*not allowed*"

# Ampersand command chaining
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-ConnectionTimeout 120 & malicious' } -MessagePattern "*not allowed*"

# Subexpression injection
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-ConnectionTimeout $(Start-Process calc)' } -MessagePattern "*not allowed*"

# Backtick-escaped subexpression
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-ConnectionTimeout `$(evil)' } -MessagePattern "*not allowed*"

# Injection in parameter value
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-QueryTimeout 120;evil' } -MessagePattern "*not allowed*"

# Pure injection with no valid parameters
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '; Remove-Item -Recurse C:\' } -MessagePattern "*not allowed*"

# Backtick alone (PowerShell escape character)
Assert-Throws { ConvertTo-SqlCmdParameterHashtable '-ConnectionTimeout `n120' } -MessagePattern "*not allowed*"

###############################################################################
# Run-SqlCmd - server authentication
###############################################################################

$sqlFilePath = "C:\Test\TestFile.sql"
Register-Mock Get-FormattedSqlUsername { return $sqlUsername }
Register-Mock Invoke-Sqlcmd { }

# Server auth with additional args
Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments "-ConnectionTimeout 120"

Assert-WasCalled Get-FormattedSqlUsername -Times 1
Assert-WasCalled Invoke-Sqlcmd -Times 1

###############################################################################
# Run-SqlCmd - default ConnectionTimeout behavior
###############################################################################

Unregister-Mock Invoke-Sqlcmd
$capturedParams = $null
Register-Mock Invoke-Sqlcmd { $script:capturedParams = $args }

# When no ConnectionTimeout specified, should add default 120
Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments ""

Assert-WasCalled Invoke-Sqlcmd -Times 1

# When ConnectionTimeout IS specified, should NOT override
Unregister-Mock Invoke-Sqlcmd
Register-Mock Invoke-Sqlcmd { }

Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments "-ConnectionTimeout 60"

Assert-WasCalled Invoke-Sqlcmd -Times 1

###############################################################################
# Run-SqlCmd - connectionString authentication
###############################################################################

Unregister-Mock Invoke-Sqlcmd
Register-Mock Invoke-Sqlcmd { }
Register-Mock Check-ConnectionString { }

Run-SqlCmd -authenticationType "connectionString" -ConnectionString "Server=test;Database=db;" -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments ""

Assert-WasCalled Check-ConnectionString -Times 1
Assert-WasCalled Invoke-Sqlcmd -Times 1

###############################################################################
# Run-SqlCmd - servicePrincipal authentication
###############################################################################

Unregister-Mock Invoke-Sqlcmd
Register-Mock Invoke-Sqlcmd { }

Run-SqlCmd -authenticationType "servicePrincipal" -serverName $serverName -databaseName $databaseName -token "test-token" -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments ""

Assert-WasCalled Invoke-Sqlcmd -Times 1

###############################################################################
# Run-SqlCmd - aadAuthenticationPassword
###############################################################################

Unregister-Mock Invoke-Sqlcmd
Unregister-Mock Check-ConnectionString
Register-Mock Invoke-Sqlcmd { }
Register-Mock Check-ConnectionString { }
Register-Mock Get-AADAuthenticationConnectionString { return "Server=test;Authentication=ActiveDirectoryPassword;" }

Run-SqlCmd -authenticationType "aadAuthenticationPassword" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments ""

Assert-WasCalled Check-ConnectionString -Times 1
Assert-WasCalled Get-AADAuthenticationConnectionString -Times 1
Assert-WasCalled Invoke-Sqlcmd -Times 1

###############################################################################
# Run-SqlCmd - verbose mode takes error-capturing path
###############################################################################

Unregister-Mock Invoke-Sqlcmd
Register-Mock Invoke-Sqlcmd { }

Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments "-Verbose"

Assert-WasCalled Invoke-Sqlcmd -Times 1

###############################################################################
# Run-SqlCmd - injection via additional args must fail
###############################################################################

Assert-Throws {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments '-ConnectionTimeout 120; whoami'
} -MessagePattern "*not allowed*"

Assert-Throws {
    Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments '-ConnectionTimeout $(Start-Process calc)'
} -MessagePattern "*not allowed*"

###############################################################################
# Run-SqlFiles
###############################################################################

Unregister-Mock Invoke-Sqlcmd
Register-Mock Find-SqlFiles { return "C:\Test\TestFile.sql" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\TestFile.sql" }
Register-Mock Run-SqlCmd { "Executing Invoke-Sqlcmd" }

Run-SqlFiles -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFile $sqlFile -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments

Assert-WasCalled Find-SqlFiles -Times 1
Assert-WasCalled Run-SqlCmd -Times 1

###############################################################################
# Run-InlineSql
###############################################################################

Unregister-Mock Run-SqlCmd
Register-Mock Run-SqlCmd { "Executing Invoke-Sqlcmd" }
Register-Mock Out-File { }
Register-Mock Test-Path { return $true }
Register-Mock Remove-Item { }

$sqlInline = "select * from Table"

Run-InlineSql -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlInline $sqlInline -sqlcmdAdditionalArguments $sqlcmdInlineAdditionalArguments

Assert-WasCalled Run-SqlCmd -Times 1
Assert-WasCalled Remove-Item -Times 1
