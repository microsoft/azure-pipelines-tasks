[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
$variableSets = @(
    @{ PreferredModule = 'Azure', 'AzureRM' }
    @{ PreferredModule = 'Azure' }
    @{ PreferredModule = 'AzureRM' }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Import-FromModulePath
    Unregister-Mock Import-FromSdkPath
    Register-Mock Import-FromModulePath
    Register-Mock Import-FromSdkPath

    # Act/Assert.
    Assert-Throws { & $module Import-AzureModule -PreferredModule $variableSet.PreferredModule } -MessagePattern AZ_ModuleNotFound
}
