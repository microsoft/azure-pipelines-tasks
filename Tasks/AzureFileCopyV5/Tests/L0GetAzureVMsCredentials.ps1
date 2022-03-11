[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$userName = "userName"
$password = "password"

# Test 1 "Should return System.Net.NetworkCredential with valid values"
$result = Get-AzureVMsCredentials -vmsAdminUserName $userName -vmsAdminPassword $password
Assert-AreEqual "System.Net.NetworkCredential" $result.GetType().FullName
Assert-AreEqual $userName $result.userName
Assert-AreEqual $password $result.Password