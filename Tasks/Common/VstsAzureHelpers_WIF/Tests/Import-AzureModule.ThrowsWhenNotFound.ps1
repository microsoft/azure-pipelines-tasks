[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
Register-Mock Import-FromModulePath
Register-Mock Import-FromSdkPath
Register-Mock Discover-AvailableAzureModules
$variableSets = @(
    @{ PreferredModule = 'Azure', 'AzureRM' }
    @{ PreferredModule = 'Azure' }
    @{ PreferredModule = 'AzureRM' }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)

    # Act/Assert.
    Assert-Throws { & $module Import-AzureModule -PreferredModule $variableSet.PreferredModule -azurePsVersion "4.1.0" } -MessagePattern "AZ_ModuleNotFound 4.1.0 Azure, AzureRM"
}
