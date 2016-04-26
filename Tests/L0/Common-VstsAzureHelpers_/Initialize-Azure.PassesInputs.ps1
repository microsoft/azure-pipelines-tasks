[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_
$variableSets = @(
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        StorageAccount = $null
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferAzureRM = $false
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferAzureRM = $false
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceNameARM'
        DeploymentEnvironmentName = $null
        StorageAccount = $null
        ExpectedServiceNameInput = 'ConnectedServiceNameARM'
        ExpectedPreferAzureRM = $true
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceNameARM'
        DeploymentEnvironmentName = $null
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'ConnectedServiceNameARM'
        ExpectedPreferAzureRM = $true
    }
    @{ 
        ConnectedServiceNameSelector = $null
        DeploymentEnvironmentName = 'Some deployment environment name'
        StorageAccount = $null
        ExpectedServiceNameInput = 'Some deployment environment name'
        ExpectedPreferAzureRM = $false
    }
    @{ 
        ConnectedServiceNameSelector = $null
        DeploymentEnvironmentName = 'Some deployment environment name'
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'Some deployment environment name'
        ExpectedPreferAzureRM = $false
    }
)
Register-Mock Import-AzureModule
Register-Mock Initialize-AzureSubscription
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Get-VstsInput
    Unregister-Mock Get-VstsEndpoint
    Register-Mock Get-VstsInput { $variableSet.ConnectedServiceNameSelector } -- -Name ConnectedServiceNameSelector -Default 'ConnectedServiceName'
    Register-Mock Get-VstsInput { $variableSet.DeploymentEnvironmentName } -- -Name DeploymentEnvironmentName
    Register-Mock Get-VstsInput { 'Some service name' } -- -Name $variableSet.ExpectedServiceNameInput -Default $variableSet.DeploymentEnvironmentName
    Register-Mock Get-VstsEndpoint { 'Some endpoint' } -- -Name 'Some service name' -Require
    Register-Mock Get-VstsInput { $variableSet.StorageAccount } -- -Name StorageAccount

    # Act.
    Initialize-Azure

    # Assert.
    Assert-WasCalled Import-AzureModule -- -PreferAzureRM: $variableSet.ExpectedPreferAzureRM
    Assert-WasCalled Initialize-AzureSubscription -- -Endpoint 'Some endpoint' -StorageAccount $variableSet.StorageAccount
}
