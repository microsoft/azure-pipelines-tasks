[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$rmModule = @{ Name = 'AzureRM' ;
               Path = 'Path to AzureRM' ;
               Version = [version]'4.1.0' ;
               NestedModules = @(
                    @{
                        Name = "AzureRM.Websites"
                    }
                    @{
                        Name = "AzureRM.Compute"
                    }
                );
               RequiredModules = @()
}
Register-Mock Get-Module { $rmModule } -- -Name $rmModule.Name -ListAvailable
Register-Mock Get-Module { $rmModule } -- -Name $rmModule.Name
Register-Mock Import-Module { $rmModule } -- -Name $rmModule.Path -RequiredVersion "4.1.0" -Global -PassThru

# Act/Assert.
Assert-Throws { & $module Import-FromModulePath -Classic:$false -azurePsVersion "4.1.0" } -MessagePattern AZ_AzureRMProfileModuleNotFound
