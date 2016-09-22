[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$rmModule = @{ Name = 'AzureRM' ; Path = 'Path to AzureRM' ; Version = [version]'1.2.3.4' }
Register-Mock Get-Module { $rmModule } -- -Name $rmModule.Name -ListAvailable
Register-Mock Import-Module { $rmModule } -- -Name $rmModule.Path -Global -PassThru

# Act/Assert.
Assert-Throws { & $module Import-FromModulePath -Classic:$false } -MessagePattern AZ_AzureRMProfileModuleNotFound
