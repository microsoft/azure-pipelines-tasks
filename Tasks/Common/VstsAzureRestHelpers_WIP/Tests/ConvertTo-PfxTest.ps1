[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1

$pemFileContent = "Test Certificate"

Register-Mock Add-Tls12InSession
Register-Mock Set-Content  { }
Register-Mock Invoke-VstsTool { }

$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$pfxFilePath, $pfxPassword = & $module ConvertTo-Pfx -pemFileContent $pemFileContent

Assert-IsNotNullOrEmpty $pfxFilePath
Assert-IsNotNullOrEmpty $pfxPassword
Assert-WasCalled Invoke-VstsTool -Times 1 



