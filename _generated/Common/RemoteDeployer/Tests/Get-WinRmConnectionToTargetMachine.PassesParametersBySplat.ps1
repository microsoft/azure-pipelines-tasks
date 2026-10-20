[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# Every value must reach New-PSSession bound to its named parameter as data - including a
# computer name and port carrying shell metacharacters, which must stay single literals.
$cred = New-Object System.Management.Automation.PSCredential('user', (New-Object System.Security.SecureString))
Register-Mock New-PSSession { [pscustomobject]@{ Name = 'session1' } }

$null = & $module Get-WinRmConnectionToTargetMachine "host'; whoami; #" "5985'; calc.exe; #" $cred 'Negotiate' 'sess1' 'microsoft.powershell32' 3 5 -useSsl

Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains "host'; whoami; #" }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains "5985'; calc.exe; #" }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains 'Negotiate' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains 'sess1' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains 'microsoft.powershell32' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains 'SilentlyContinue' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains 'sessionErrors' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains '-Credential:' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains '-UseSSL:' }