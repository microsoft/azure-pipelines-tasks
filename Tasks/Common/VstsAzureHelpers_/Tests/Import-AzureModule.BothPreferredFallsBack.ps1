[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$variableSets = @(
    # Combinations for only one preference matched:
    @{
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
        RMModulePathResult = $false
        RMSdkPathResult = $false
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
        RMModulePathResult = $false
        RMSdkPathResult = $false
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $false
        RMModulePathResult = $true
        RMSdkPathResult = $null
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $false
        RMModulePathResult = $false
        RMSdkPathResult = $true
    }
    # Combinations for both preferences matched:
    @{
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
        RMModulePathResult = $true
        RMSdkPathResult = $null
    }
    @{
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
        RMModulePathResult = $false
        RMSdkPathResult = $true
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
        RMModulePathResult = $true
        RMSdkPathResult = $null
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
        RMModulePathResult = $false
        RMSdkPathResult = $true
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Import-FromModulePath
    Unregister-Mock Import-FromSdkPath
    Register-Mock Import-FromModulePath
    Register-Mock Import-FromSdkPath
    if ($variableSet.RMModulePathResult -ne $null) {
        Register-Mock Import-FromModulePath { $variableSet.RMModulePathResult } -- -Classic: $false -azurePsVersion "4.1.0"
    }

    if ($variableSet.RMSdkPathResult -ne $null) {
        Register-Mock Import-FromSdkPath { $variableSet.RMSdkPathResult } -- -Classic: $false -azurePsVersion "4.1.0"
    }

    if ($variableSet.ClassicModulePathResult -ne $null) {
        Register-Mock Import-FromModulePath { $variableSet.ClassicModulePathResult } -- -Classic: $true -azurePsVersion "4.1.0"
    }

    if ($variableSet.ClassicSdkPathResult -ne $null) {
        Register-Mock Import-FromSdkPath { $variableSet.ClassicSdkPathResult } -- -Classic: $true -azurePsVersion "4.1.0"
    }

    # Act.
    & $module Import-AzureModule -PreferredModule 'Azure', 'AzureRM' -azurePsVersion "4.1.0"

    # Assert.
    Assert-WasCalled Import-FromModulePath -Times $(if ($variableSet.RMModulePathResult -eq $null) { 0 } else { 1 }) -- -Classic: $false -azurePsVersion "4.1.0"
    Assert-WasCalled Import-FromSdkPath -Times $(if ($variableSet.RMSdkPathResult -eq $null) { 0 } else { 1 }) -- -Classic: $false -azurePsVersion "4.1.0"
    Assert-WasCalled Import-FromModulePath -Times $(if ($variableSet.ClassicModulePathResult -eq $null) { 0 } else { 1 }) -- -Classic: $true -azurePsVersion "4.1.0"
    Assert-WasCalled Import-FromSdkPath -Times $(if ($variableSet.ClassicSdkPathResult -eq $null) { 0 } else { 1 }) -- -Classic: $true -azurePsVersion "4.1.0"
}
