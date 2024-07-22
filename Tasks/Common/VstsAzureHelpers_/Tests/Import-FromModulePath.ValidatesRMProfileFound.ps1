[CmdletBinding()]
param()

$featureFlags = @{
    retireAzureRM = [System.Convert]::ToBoolean($env:RETIRE_AZURERM_POWERSHELL_MODULE)
}

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

if ($featureFlags.retireAzureRM) {
    $isModuleExists = $false;
    Get-Command -Module $module | ForEach-Object {
        if ($_.name -match "Import-FromModulePath") {
            $isModuleExists = $true;
        }
    }
    Assert-AreEqual -Expected $false -Actual $isModuleExists -Message "Property should not exists"
} else {
    # Act/Assert.
    Assert-Throws { & $module Import-FromModulePath -Classic:$false -azurePsVersion "4.1.0" } -MessagePattern AZ_AzureRMProfileModuleNotFound
}