[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
Register-Mock Import-FromModulePath { $true }
& $module { $script:azureModule = @{ Version = [version]'0.8.10.0' } }

# Act/Assert.
Assert-Throws { & $module Import-AzureModule -PreferredModule 'Azure' } -MessagePattern AZ_RequiresMinVersion0*
