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
$variableSets = @(
    @{
        Classic = $true
        Modules = @(
            @{
                Name = 'Azure'
                Path = 'Path to Azure'
                Version = [version]'4.1.0'
            }
        )
    }
    @{
        Classic = $false
        Modules = @(
            @{
                Name = 'AzureRM'
                Path = 'Path to AzureRM'
                Version = [version]'4.1.0'
                NestedModules = @(
                    @{
                        Name = 'AzureRM.Profile'
                        Path = 'Path to AzureRM.profile'
                    }
                )
            }
            @{
                Name = 'AzureRM.profile'
                Path = 'Path to AzureRM.profile'
                Version = [version]'4.1.0'
            }
        )
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Get-Module
    Unregister-Mock Import-Module
    Register-Mock Get-Module { $variableSet.Modules[0] } -- -Name $variableSet.Modules[0].Name -ListAvailable
    Register-Mock Import-Module { $variableSet.Modules[0] } -- -Name $variableSet.Modules[0].Path -Global -PassThru -Force
    if ($variableSet.Modules.Length -eq 2) {
        Register-Mock Get-Module { $variableSet.Modules[0] } -- -Name $variableSet.Modules[0].Name
        Register-Mock Import-Module { $variableSet.Modules[1] } -- -Name $variableSet.Modules[1].Path -Global -PassThru -Force
    }

    if ($featureFlags.retireAzureRM) {
        $isModuleExists = $false;
        Get-Command -Module $module | ForEach-Object {
            if ($_.name -match "Import-FromModulePath") {
                $isModuleExists = $true;
            }
        }
        Assert-AreEqual -Expected $false -Actual $isModuleExists -Message "Property should not exists"
    } else {
        # Act.
        $result = & $module Import-FromModulePath -Classic:($variableSet.Classic) -azurePsVersion "4.1.0"

        # Assert.
        Assert-AreEqual $true $result
        Assert-WasCalled Import-Module -- -Name $variableSet.Modules[0].Path -Global -PassThru -Force
        if ($variableSet.Modules.Length -eq 2) {
            Assert-WasCalled Import-Module -- -Name $variableSet.Modules[1].Path -Global -PassThru -Force
        }

        if ($variableSet.Classic) {
            Assert-AreEqual $variableSet.Modules[0] (& $module { $script:azureModule })
        } else {
            Assert-AreEqual $variableSet.Modules[1] (& $module { $script:azureRMProfileModule })
        }
    }
}
