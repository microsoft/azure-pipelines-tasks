[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"

#should not throw
$IPAddress = Get-AgentIPAddress -startIPAddress $outOfRangeIPAddress -endIPAddress $endIP -ipDetectionMethod $ipDetectionMethod

Assert-AreEqual $outOfRangeIPAddress $IPAddress.StartIPAddress
Assert-AreEqual $endIP $IPAddress.EndIPAddress

 $IPAddress = Get-AgentIPAddress -startIPAddress $startIP -endIPAddress $endIP -ipDetectionMethod $ipDetectionMethod

Assert-AreEqual $startIP $IPAddress.StartIPAddress
Assert-AreEqual $endIP $IPAddress.EndIPAddress