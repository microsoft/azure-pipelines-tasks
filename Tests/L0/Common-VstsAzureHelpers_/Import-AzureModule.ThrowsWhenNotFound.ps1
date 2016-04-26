[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
$variableSets = @(
    @{ PreferAzureRM = $true }
    @{ PreferAzureRM = $false }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Import-FromModulePath
    Unregister-Mock Import-FromSdkPath
    Register-Mock Import-FromModulePath
    Register-Mock Import-FromSdkPath

    # Act/Assert.
    Assert-Throws { & $module Import-AzureModule -PreferAzureRM:($variableSet.PreferAzureRM) } -MessagePattern AZ_ModuleNotFound
}
