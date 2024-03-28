[CmdletBinding()]
param()


. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. "$PSScriptRoot\..\Utility.ps1"

$connectionString = Get-WindowsAuthenticationConnectionString -serverName "localhost" -databaseName "test"

Assert-AreEqual -Expected "Data Source=localhost; Initial Catalog=test; Integrated Security=SSPI;" -Actual $connectionString