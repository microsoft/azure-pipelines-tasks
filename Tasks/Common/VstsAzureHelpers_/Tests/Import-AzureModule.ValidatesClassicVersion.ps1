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
Register-Mock Import-FromModulePath { $true }
& $module { $script:azureModule = @{ Version = [version]'0.8.10.0' } }

if ($featureFlags.retireAzureRM) {
  $isModuleExists = $false;
  Get-Command -Module $module | ForEach-Object {
      if ($_.name -match "Import-AzureModule") {
          $isModuleExists = $true;
      }
  }
  Assert-AreEqual -Expected $false -Actual $isModuleExists -Message "Property should not exists"
} else {
  # Act/Assert.
  Assert-Throws { & $module Import-AzureModule -PreferredModule 'Azure' } -MessagePattern AZ_RequiresMinVersion0*
}