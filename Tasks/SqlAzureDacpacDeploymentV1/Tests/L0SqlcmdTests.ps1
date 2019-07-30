# Tests for helper methods in SqlAzureActions.ps1
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

# Test Run-SqlCmd
$sqlFilePath = "C:\Test\TestFile.sql"
Register-Mock EscapeSpecialChars {return $sqlPassword}
Register-Mock Get-FormattedSqlUsername { return $sqlUsername }
Register-Mock Invoke-Expression { }

Run-SqlCmd -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments

Assert-WasCalled Get-FormattedSqlUsername -Times 1
Assert-WasCalled Invoke-Expression -Times 1

# Test Run-SqlFiles
Register-Mock Find-SqlFiles { return "C:\Test\TestFile.sql" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\TestFile.sql" }
Register-Mock Run-SqlCmd { "Executing Invoke-Sqlcmd" }

Run-SqlFiles -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFile $sqlFile -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments

Assert-WasCalled Find-SqlFiles -Times 1
Assert-WasCalled Run-SqlCmd -Times 1

# Test Run-InlineSql
Unregister-Mock Run-SqlCmd

Register-Mock Run-SqlCmd { "Executing Invoke-Sqlcmd" }
Register-Mock Out-File { }
Register-Mock Test-Path { return $true }
Register-Mock Remove-Item { }

$sqlInline = "select * from Table"

Run-InlineSql -authenticationType "server" -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlInline $sqlInline -sqlcmdAdditionalArguments $sqlcmdInlineAdditionalArguments

Assert-WasCalled Run-SqlCmd -Times 1
Assert-WasCalled Remove-Item -Times 1
