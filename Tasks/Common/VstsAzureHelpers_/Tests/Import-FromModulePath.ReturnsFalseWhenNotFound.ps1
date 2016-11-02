[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
Register-Mock Get-Module
$variableSets = @(
    @{ Classic = $true }
    @{ Classic = $false }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)

    # Act.
    $result = & $module Import-FromModulePath -Classic:($variableSet.Classic)

    # Assert.
    Assert-AreEqual $false $result
}