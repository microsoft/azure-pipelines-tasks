[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# A session is returned on the first attempt, so the function returns it without retrying.
Register-Mock New-PSSession { [pscustomobject]@{ Name = 'session1' } }

$session = & $module Get-WinRmConnectionToTargetMachine 'computer1' '5985' $null 'Default' 'session1' 'microsoft.powershell' 3 5

Assert-AreEqual 'session1' $session.Name
Assert-WasCalled New-PSSession -Times 1