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
Register-Mock Get-Module
$variableSets = @(
    @{ Classic = $true }
    @{ Classic = $false }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)

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
        $result = & $module Import-FromModulePath -Classic:($variableSet.Classic)

        # Assert.
        Assert-AreEqual $false $result
    }
}