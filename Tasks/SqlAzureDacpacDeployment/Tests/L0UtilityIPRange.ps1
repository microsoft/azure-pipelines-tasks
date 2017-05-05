[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"

# If connection failed because of firewall exception
$sqlErrorMsg = "Sqlcmd: Error: Microsoft ODBC Driver 13 for SQL Server : Cannot open server 'a0nuel7r2k' requested by the login. Client with IP address '167.220.238.x' is not allowed to access the server.  To enable access, use the Windows Azure Management P
ortal or run sp_set_firewall_rule on the master database to create a firewall rule for this IP address or address range.  It may take up to five minutes for this change to take effect..
"
$firewallException = New-Object -TypeName System.Management.Automation.RemoteException -ArgumentList $sqlErrorMsg
$errors = @()
$errors += $firewallException

$sqlCmd1 = New-Object PsObject
$sqlCmd1 | Add-Member -MemberType NoteProperty -Name "Path" -Value "SqlCmd.exe"
Register-Mock Get-Command { Write-Output $sqlCmd1 } -ParametersEvaluator { $Name -eq "SqlCmd.exe" -and $ErrorAction -eq 'SilentlyContinue' }

$startIP = "167.220.238.0"
$endIP = "167.220.238.255"

Register-Mock Invoke-Expression { Write-Error $firewallException } -ParametersEvaluator { }
$IPAddressRange = Get-AgentIPRange -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

Assert-AreEqual  $startIP $IPAddressRange.StartIPAddress
Assert-AreEqual $endIP $IPAddressRange.EndIPAddress

# If connection succeeded without firewall exception
$errors = @()
Register-Mock Invoke-Expression {  } -ParametersEvaluator { }

$IPAddressRange = Get-AgentIPRange -serverName $serverName -sqlUserName $sqlUsername -sqlPassword $sqlPassword

Assert-AreEqual 0 $IPAddressRange.Count