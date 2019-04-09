[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
$variableSets = @(
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'ServicePrincipal' } }
        StorageAccount = $null
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferredModule = ,'AzureRM'
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'UserNamePassword' } }
        StorageAccount = $null
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferredModule = 'Azure', 'AzureRM'
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'UserNamePassword' } }
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferredModule = 'Azure', 'AzureRM'
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'Certificate' } }
        StorageAccount = $null
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferredModule = ,'Azure'
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceName'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'Certificate' } }
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'ConnectedServiceName'
        ExpectedPreferredModule = ,'Azure'
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceNameARM'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'ServicePrincipal' } }
        StorageAccount = $null
        ExpectedServiceNameInput = 'ConnectedServiceNameARM'
        ExpectedPreferredModule = ,'AzureRM'
    }
    @{
        ConnectedServiceNameSelector = 'ConnectedServiceNameARM'
        DeploymentEnvironmentName = $null
        Endpoint = @{ Auth = @{ Scheme = 'ServicePrincipal' } }
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'ConnectedServiceNameARM'
        ExpectedPreferredModule = ,'AzureRM'
    }
    @{ 
        ConnectedServiceNameSelector = $null
        DeploymentEnvironmentName = 'Some deployment environment name'
        StorageAccount = $null
        ExpectedServiceNameInput = 'Some deployment environment name'
        ExpectedPreferredModule = ,'Azure'
    }
    @{ 
        ConnectedServiceNameSelector = $null
        DeploymentEnvironmentName = 'Some deployment environment name'
        StorageAccount = 'Some storage account'
        ExpectedServiceNameInput = 'Some deployment environment name'
        ExpectedPreferredModule = ,'Azure'
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
    Register-Mock Get-VstsInput { "LatestVersion" } -- -TargetAzurePs
    Register-Mock Get-VstsInput { 'Some service name' } -- -Name $variableSet.ExpectedServiceNameInput -Default $variableSet.DeploymentEnvironmentName
    Register-Mock Get-VstsEndpoint { $variableSet.Endpoint } -- -Name 'Some service name' -Require
    Register-Mock Get-VstsInput { $variableSet.StorageAccount } -- -Name StorageAccount

    # Act.
    Initialize-Azure

    # Assert.
    Assert-WasCalled Import-AzureModule -- -PreferredModule $variableSet.ExpectedPreferredModule -azurePsVersion "" -strict:$false
    Assert-WasCalled Initialize-AzureSubscription -- -Endpoint $variableSet.Endpoint -StorageAccount $variableSet.StorageAccount
}
