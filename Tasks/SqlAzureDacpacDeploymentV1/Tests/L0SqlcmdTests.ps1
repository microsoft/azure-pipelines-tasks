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
# ConvertTo-SqlCmdParameterHashtable - comma-separated arrays
###############################################################################

# Comma-separated array (Invoke-Sqlcmd -Variable "A","B" pattern)
$result = ConvertTo-SqlCmdParameterHashtable '-Variable "MYVAR1=String1","MYVAR2=String2"'
Assert-AreEqual 2 $result['Variable'].Count "Should parse two array elements"
Assert-AreEqual "MYVAR1=String1" $result['Variable'][0] "Should parse first array element"
Assert-AreEqual "MYVAR2=String2" $result['Variable'][1] "Should parse second array element"

# Three-element array
$result = ConvertTo-SqlCmdParameterHashtable '-Variable "A=1","B=2","C=3"'
Assert-AreEqual 3 $result['Variable'].Count "Should parse three array elements"

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - special characters in quoted values
###############################################################################

# Semicolons inside quoted values (connection string style)
$result = ConvertTo-SqlCmdParameterHashtable '-Variable "Server=x;Database=y;"'
Assert-AreEqual "Server=x;Database=y;" $result['Variable'] "Should allow semicolons inside quotes"

# Equals signs and semicolons in quoted values
$result = ConvertTo-SqlCmdParameterHashtable '-Variable "key=a;b=c"'
Assert-AreEqual "key=a;b=c" $result['Variable'] "Should allow complex values inside quotes"

# Mixed special chars and normal params
$result = ConvertTo-SqlCmdParameterHashtable '-Variable "Server=x;Database=y;" -ConnectionTimeout 60'
Assert-AreEqual "Server=x;Database=y;" $result['Variable'] "Should parse quoted special chars"
Assert-AreEqual 60 $result['ConnectionTimeout'] "Should parse following int param"

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - boolean and enum values
###############################################################################

# Explicit $true value
$result = ConvertTo-SqlCmdParameterHashtable '-OutputSqlErrors $true'
Assert-AreEqual $true $result['OutputSqlErrors'] "Should parse `$true as boolean"

# Explicit $false value
$result = ConvertTo-SqlCmdParameterHashtable '-OutputSqlErrors $false'
Assert-AreEqual $false $result['OutputSqlErrors'] "Should parse `$false as boolean"

# Enum-like string values
$result = ConvertTo-SqlCmdParameterHashtable "-ApplicationIntent ReadOnly"
Assert-AreEqual "ReadOnly" $result['ApplicationIntent'] "Should parse enum string value"

$result = ConvertTo-SqlCmdParameterHashtable "-Encrypt Mandatory"
Assert-AreEqual "Mandatory" $result['Encrypt'] "Should parse Encrypt as string"

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - multiple string parameters
###############################################################################

$result = ConvertTo-SqlCmdParameterHashtable '-HostName "MyHost" -ApplicationName "MyApp"'
Assert-AreEqual "MyHost" $result['HostName'] "Should parse first string param"
Assert-AreEqual "MyApp" $result['ApplicationName'] "Should parse second string param"

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - mixed parameter types
###############################################################################

$result = ConvertTo-SqlCmdParameterHashtable "-ConnectionTimeout 120 -AbortOnError"
Assert-AreEqual 120 $result['ConnectionTimeout'] "Should parse int in mixed"
Assert-AreEqual $true $result['AbortOnError'] "Should parse switch in mixed"

$result = ConvertTo-SqlCmdParameterHashtable "-ConnectionTimeout 120 -Verbose"
Assert-AreEqual 120 $result['ConnectionTimeout'] "Should parse int before verbose"
Assert-AreEqual $true $result['Verbose'] "Should parse verbose as switch"

###############################################################################
# ConvertTo-SqlCmdParameterHashtable - complex real-world scenarios
###############################################################################

# Full ADO.NET connection string with semicolons
$result = ConvertTo-SqlCmdParameterHashtable '-ConnectionString "Data Source=myserver.database.windows.net;Initial Catalog=mydb;Integrated Security=True;ApplicationIntent=ReadOnly"'
Assert-AreEqual "Data Source=myserver.database.windows.net;Initial Catalog=mydb;Integrated Security=True;ApplicationIntent=ReadOnly" $result['ConnectionString'] "Should parse full connection string with semicolons"

# Variable array with single-quoted SQL values (MS docs Example 3 pattern)
$result = ConvertTo-SqlCmdParameterHashtable "-Variable `"MYVAR1='String1'`",`"MYVAR2='String2'`""
Assert-AreEqual 2 $result['Variable'].Count "Should parse doc-example variable array"
Assert-AreEqual "MYVAR1='String1'" $result['Variable'][0] "Should preserve single quotes in array[0]"
Assert-AreEqual "MYVAR2='String2'" $result['Variable'][1] "Should preserve single quotes in array[1]"

# Kitchen sink: int + string + switch + array in one call
$result = ConvertTo-SqlCmdParameterHashtable "-ConnectionTimeout 120 -HostName `"build-agent-01`" -AbortOnError -Variable `"Env=prod`",`"Region=westus`""
Assert-AreEqual 120 $result['ConnectionTimeout'] "Kitchen sink: int"
Assert-AreEqual "build-agent-01" $result['HostName'] "Kitchen sink: string"
Assert-AreEqual $true $result['AbortOnError'] "Kitchen sink: switch"
Assert-AreEqual 2 $result['Variable'].Count "Kitchen sink: array count"

# Windows file path with backslashes
$result = ConvertTo-SqlCmdParameterHashtable '-InputFile "C:\Build\Scripts\deploy.sql" -ConnectionTimeout 60'
Assert-AreEqual "C:\Build\Scripts\deploy.sql" $result['InputFile'] "Should parse Windows path"
Assert-AreEqual 60 $result['ConnectionTimeout'] "Should parse int after path"

# SQL query with brackets and single quotes
$result = ConvertTo-SqlCmdParameterHashtable "-Query `"SELECT COUNT(*) FROM [dbo].[Users] WHERE Name = 'test'`""
Assert-AreEqual "SELECT COUNT(*) FROM [dbo].[Users] WHERE Name = 'test'" $result['Query'] "Should parse SQL query"

# Server instance with comma port
$result = ConvertTo-SqlCmdParameterHashtable '-ServerInstance "myserver.database.windows.net,1433" -Database "mydb"'
Assert-AreEqual "myserver.database.windows.net,1433" $result['ServerInstance'] "Should parse server with port"
Assert-AreEqual "mydb" $result['Database'] "Should parse database after server"

# Azure TLS combo: enum + switch + wildcard cert
$result = ConvertTo-SqlCmdParameterHashtable '-Encrypt Mandatory -TrustServerCertificate -HostNameInCertificate "*.database.windows.net"'
Assert-AreEqual "Mandatory" $result['Encrypt'] "Should parse Encrypt enum"
Assert-AreEqual $true $result['TrustServerCertificate'] "Should parse TrustServerCertificate switch"
Assert-AreEqual "*.database.windows.net" $result['HostNameInCertificate'] "Should parse wildcard cert"

# Five integer params
$result = ConvertTo-SqlCmdParameterHashtable '-ErrorLevel 1 -SeverityLevel 10 -MaxCharLength 8000 -MaxBinaryLength 4096 -QueryTimeout 300'
Assert-AreEqual 1 $result['ErrorLevel'] "Should parse ErrorLevel"
Assert-AreEqual 10 $result['SeverityLevel'] "Should parse SeverityLevel"
Assert-AreEqual 8000 $result['MaxCharLength'] "Should parse MaxCharLength"
Assert-AreEqual 4096 $result['MaxBinaryLength'] "Should parse MaxBinaryLength"
Assert-AreEqual 300 $result['QueryTimeout'] "Should parse QueryTimeout"

# Variable array with semicolons and paths inside values
$result = ConvertTo-SqlCmdParameterHashtable "-Variable `"ConnStr=Server=x;Database=y;`",`"Mode=ReadOnly`",`"Path=C:\temp\out.txt`""
Assert-AreEqual 3 $result['Variable'].Count "Should parse 3-element mixed array"
Assert-AreEqual "ConnStr=Server=x;Database=y;" $result['Variable'][0] "Should preserve semicolons in array element"
Assert-AreEqual "Mode=ReadOnly" $result['Variable'][1] "Should parse simple array element"
Assert-AreEqual "Path=C:\temp\out.txt" $result['Variable'][2] "Should parse path in array element"

# OutputAs + StatisticsVariable
$result = ConvertTo-SqlCmdParameterHashtable '-OutputAs DataTables -StatisticsVariable "stats"'
Assert-AreEqual "DataTables" $result['OutputAs'] "Should parse OutputAs enum"
Assert-AreEqual "stats" $result['StatisticsVariable'] "Should parse StatisticsVariable"

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
