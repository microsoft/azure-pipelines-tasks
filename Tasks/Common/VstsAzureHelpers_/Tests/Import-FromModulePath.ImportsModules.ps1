[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$variableSets = @(
    @{
        Classic = $true
        Modules = @(
            @{
                Name = 'Azure'
                Path = 'Path to Azure'
                Version = [version]'1.2.3.4'
            }
        )
    }
    @{
        Classic = $false
        Modules = @(
            @{
                Name = 'AzureRM'
                Path = 'Path to AzureRM'
                Version = [version]'2.3.4.5'
            }
            @{
                Name = 'AzureRM.profile'
                Path = 'Path to AzureRM.profile'
                Version = [version]'3.4.5.6'
            }
        )
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Get-Module
    Unregister-Mock Import-Module
    Register-Mock Get-Module { $variableSet.Modules[0] } -- -Name $variableSet.Modules[0].Name -ListAvailable
    Register-Mock Import-Module { $variableSet.Modules[0] } -- -Name $variableSet.Modules[0].Path -Global -PassThru
    if ($variableSet.Modules.Length -eq 2) {
        Register-Mock Get-Module { $variableSet.Modules[1] } -- -Name $variableSet.Modules[1].Name -ListAvailable
        Register-Mock Import-Module { $variableSet.Modules[1] } -- -Name $variableSet.Modules[1].Path -Global -PassThru
    }

    # Act.
    $result = & $module Import-FromModulePath -Classic:($variableSet.Classic)

    # Assert.
    Assert-AreEqual $true $result
    Assert-WasCalled Import-Module -- -Name $variableSet.Modules[0].Path -Global -PassThru
    if ($variableSet.Modules.Length -eq 2) {
        Assert-WasCalled Import-Module -- -Name $variableSet.Modules[1].Path -Global -PassThru
    }

    if ($variableSet.Classic) {
        Assert-AreEqual $variableSet.Modules[0] (& $module { $script:azureModule })
    } else {
        Assert-AreEqual $variableSet.Modules[1] (& $module { $script:azureRMProfileModule })
    }
}
