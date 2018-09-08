[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
Register-Mock Invoke-Expression { $null }

Assert-Throws {
    & $module Get-WinRmConnectionToTargetMachine 'computer1' '5985' $null 'Default' 'session1' 'microsoft.powershell' 2 5
} -MessagePattern "RemoteDeployer_NotConnectedMachines*"

Assert-WasCalled Invoke-Expression -Times 2