[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
Register-Mock Import-FromModulePath { $true }
& $module { $script:isClassic = $true ; $script:classicVersion = [version]'0.8.10.0' }

# Act/Assert.
Assert-Throws { & $module Import-AzureModule -PreferAzureRM:($variableSet.PreferAzureRM) } -MessagePattern AZ_RequiresMinVersion0*
