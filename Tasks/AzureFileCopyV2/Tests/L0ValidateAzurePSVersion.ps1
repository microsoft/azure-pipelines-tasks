[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1

$lowerThanMinimumAzureVersion = New-Object -TypeName System.Version -ArgumentList "0.8.8"
$minimumAzureVersion = New-Object -TypeName System.Version -ArgumentList "0.9.0"
$greaterThanMinimumAzureVersion = New-Object -TypeName System.Version -ArgumentList "0.9.8"

Register-Mock Get-AzureCmdletsVersion { return $lowerThanMinimumAzureVersion }
Register-Mock Write-Telemetry

#Test 1 "Should throw if lower azureps version"
Assert-Throws {
    Validate-AzurePowershellVersion
} -MessagePattern "*AFC_AzurePSNotInstalled*"

#Test 2 "Should throw if lower azureps version"
Unregister-Mock Get-AzureCmdletsVersion
Register-Mock Get-AzureCmdletsVersion { return $greaterThanMinimumAzureVersion }

Validate-AzurePowershellVersion
Assert-WasCalled -Times 1 Get-AzureCmdletsVersion
