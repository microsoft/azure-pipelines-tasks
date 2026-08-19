[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# New-PSSession returns $null on every attempt, so the function exhausts its retries and throws.
Register-Mock New-PSSession { $null }

Assert-Throws {
    & $module Get-WinRmConnectionToTargetMachine 'computer1' '5985' $null 'Default' 'session1' 'microsoft.powershell' 2 5
} -MessagePattern "RemoteDeployer_NotConnectedMachines*"

Assert-WasCalled New-PSSession -Times 2