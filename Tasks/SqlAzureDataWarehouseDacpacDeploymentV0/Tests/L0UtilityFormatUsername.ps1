[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"

$formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsername -serverName $serverName
Assert-AreEqual  $sqlUsername $formattedSqlUsername

$formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsernameWithServerName -serverName $serverName
Assert-AreEqual  $sqlUsernameWithServerName $formattedSqlUsername

$formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsernameWithAtSymbol -serverName $serverName
$expectedUsername = $sqlUsernameWithAtSymbol + "@" + $serverName
Assert-AreEqual  $expectedUsername $formattedSqlUsername

$formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsernameWithAtSymbol -serverName $serverNameWithTcpPrefix
$expectedUsername = $sqlUsernameWithAtSymbol + "@" + $serverName
Assert-AreEqual  $expectedUsername $formattedSqlUsername

$formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsernameWithServerName -serverName $serverNameWithTcpPrefix
Assert-AreEqual  $sqlUsernameWithServerName $formattedSqlUsername

$formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsername -serverName $serverNameWithTcpPrefix
Assert-AreEqual  $sqlUsername $formattedSqlUsername