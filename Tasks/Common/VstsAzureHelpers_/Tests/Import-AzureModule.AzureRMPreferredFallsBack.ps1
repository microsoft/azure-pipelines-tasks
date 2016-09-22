[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$variableSets = @(
    @{
        RMModulePathResult = $true
        RMSdkPathResult = $null
        ClassicModulePathResult = $null
        ClassicSdkPathResult = $null
    }
    @{
        RMModulePathResult = $false
        RMSdkPathResult = $true
        ClassicModulePathResult = $null
        ClassicSdkPathResult = $null
    }
    @{
        RMModulePathResult = $false
        RMSdkPathResult = $false
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
    }
    @{
        RMModulePathResult = $false
        RMSdkPathResult = $false
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Import-FromModulePath
    Unregister-Mock Import-FromSdkPath
    Register-Mock Import-FromModulePath
    Register-Mock Import-FromSdkPath
    if ($variableSet.RMModulePathResult -ne $null) {
        Register-Mock Import-FromModulePath { $variableSet.RMModulePathResult } -- -Classic: $false
    }

    if ($variableSet.RMSdkPathResult -ne $null) {
        Register-Mock Import-FromSdkPath { $variableSet.RMSdkPathResult } -- -Classic: $false
    }

    if ($variableSet.ClassicModulePathResult -ne $null) {
        Register-Mock Import-FromModulePath { $variableSet.ClassicModulePathResult } -- -Classic: $true
    }

    if ($variableSet.ClassicSdkPathResult -ne $null) {
        Register-Mock Import-FromSdkPath { $variableSet.ClassicSdkPathResult } -- -Classic: $true
    }

    # Act.
    & $module Import-AzureModule -PreferredModule 'AzureRM'

    # Assert.
    Assert-WasCalled Import-FromModulePath -Times $(if ($variableSet.RMModulePathResult -eq $null) { 0 } else { 1 }) -- -Classic: $false
    Assert-WasCalled Import-FromSdkPath -Times $(if ($variableSet.RMSdkPathResult -eq $null) { 0 } else { 1 }) -- -Classic: $false
    Assert-WasCalled Import-FromModulePath -Times $(if ($variableSet.ClassicModulePathResult -eq $null) { 0 } else { 1 }) -- -Classic: $true
    Assert-WasCalled Import-FromSdkPath -Times $(if ($variableSet.ClassicSdkPathResult -eq $null) { 0 } else { 1 }) -- -Classic: $true
}
