[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# With no credential and no SSL, the splat must not carry -Credential or -UseSSL.
Register-Mock New-PSSession { [pscustomobject]@{ Name = 'session1' } }

$null = & $module Get-WinRmConnectionToTargetMachine 'computer1' '5985' $null 'Default' 'sess1' 'microsoft.powershell' 3 5

Assert-WasCalled New-PSSession -ArgumentsEvaluator { -not ($args -contains '-Credential:') }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { -not ($args -contains '-UseSSL:') }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains 'computer1' }
Assert-WasCalled New-PSSession -ArgumentsEvaluator { $args -contains '5985' }