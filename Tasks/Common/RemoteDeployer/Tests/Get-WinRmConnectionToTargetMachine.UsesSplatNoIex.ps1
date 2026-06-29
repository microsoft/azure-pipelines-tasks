[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# Even with metacharacter-laden host/port, the connection must never go through
# Invoke-Expression; New-PSSession is invoked directly via splat.
$cred = New-Object System.Management.Automation.PSCredential('user', (New-Object System.Security.SecureString))
Register-Mock New-PSSession { [pscustomobject]@{ Name = 'session1' } }
Register-Mock Invoke-Expression { throw 'Invoke-Expression must not be used' }

$null = & $module Get-WinRmConnectionToTargetMachine "host'; whoami; #" "5985'; calc.exe; #" $cred 'Negotiate' 'sess1' 'microsoft.powershell32' 3 5 -useSsl

Assert-WasCalled New-PSSession
Assert-WasCalled Invoke-Expression -Times 0