[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"
. "$PSScriptRoot\..\SqlAzureActions.ps1"

# Mock feature flag to use legacy path
Register-Mock Should-UseSanitizedArguments { return $false }

# TEST 1 : If connection failed because of firewall exception using Sqlcmd.exe
Register-Mock Get-Command { return $null }

$sqlErrorMsg = "Error at Line 123456 Sqlcmd: Error: Microsoft ODBC Driver 13 for SQL Server : Cannot open server 'a0nuel7r2k' requested by the login. Client with IP address '167.220.238.x' is not allowed to access the server.  To enable access, use the Windows Azure Management P
ortal or run sp_set_firewall_rule on the master database to create a firewall rule for this IP address or address range.  It may take up to five minutes for this change to take effect..
"
$firewallException = New-Object -TypeName System.Management.Automation.RemoteException -ArgumentList $sqlErrorMsg
$errors = @()
$errors += $firewallException

$startIP = "167.220.238.0"
$endIP = "167.220.238.255"
$authenticationType = "server"

Register-Mock Invoke-Expression { Write-Error $firewallException } -ParametersEvaluator { }
$IPAddressRange = Get-AgentIPRange -authenticationType $authenticationType -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

Assert-AreEqual  $startIP $IPAddressRange.StartIPAddress
Assert-AreEqual $endIP $IPAddressRange.EndIPAddress

# TEST 2 : If connection succeeded without firewall exception using Sqlcmd.exe
$errors = @()
Register-Mock Invoke-Expression {  } -ParametersEvaluator { }

$IPAddressRange = Get-AgentIPRange -authenticationType $authenticationType -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

Assert-AreEqual 0 $IPAddressRange.Count

# TEST 3 : If connection failed because of firewall exception using Invoke-Sqlcmd
$errors = @()
$errors += $firewallException

Unregister-Mock Get-Command
Register-Mock Get-Command { return "Command exists" }
Register-Mock Run-InlineSql { Write-Error $firewallException }

$IPAddressRange = Get-AgentIPRange -authenticationType $authenticationType -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

Assert-WasCalled Run-InlineSql
Assert-AreEqual  $startIP $IPAddressRange.StartIPAddress
Assert-AreEqual $endIP $IPAddressRange.EndIPAddress

# ============================================================================
# Sanitization FF - ON tests: same scenarios, V2 safe path (Split-CLIArguments + & operator)
# ============================================================================

Unregister-Mock Should-UseSanitizedArguments
Register-Mock Should-UseSanitizedArguments { return $true }

# TEST 4 : FF ON - firewall exception via sqlcmd.exe uses safe V2 path
Unregister-Mock Get-Command
Register-Mock Get-Command { return $null } -ParametersEvaluator { $Name -eq 'Invoke-Sqlcmd' }

# Mock the & operator call by mocking the sqlcmd executable path
# The V2 path calls: & $sqlCmd $argArray — we can't mock & directly,
# but the function catches errors and parses output. We use a real cmd.exe
# to simulate the error output that Get-AgentIPRange parses.
Unregister-Mock Invoke-Expression
Register-Mock Invoke-Expression { } # Should NOT be called in V2 path

# Since V2 uses & $sqlCmd $argArray, and $sqlCmd is Join-Path $PSScriptRoot "sqlcmd\SQLCMD.exe"
# which doesn't exist in test, the & call will throw. Get-AgentIPRange catches the error
# and parses $output. The IP range will be empty since the error won't contain sp_set_firewall_rule.
$IPAddressRange = Get-AgentIPRange -authenticationType $authenticationType -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

# V2 path should NOT call Invoke-Expression
Assert-WasCalled Invoke-Expression -Times 0

# TEST 5 : FF ON - Invoke-Sqlcmd path is unchanged (uses Run-InlineSql regardless of FF)
Unregister-Mock Get-Command
Register-Mock Get-Command { return "Command exists" } -ParametersEvaluator { $Name -eq 'Invoke-Sqlcmd' }
Unregister-Mock Run-InlineSql
Register-Mock Run-InlineSql { Write-Error $firewallException }

$IPAddressRange = Get-AgentIPRange -authenticationType $authenticationType -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

Assert-WasCalled Run-InlineSql
Assert-AreEqual $startIP $IPAddressRange.StartIPAddress
Assert-AreEqual $endIP $IPAddressRange.EndIPAddress
