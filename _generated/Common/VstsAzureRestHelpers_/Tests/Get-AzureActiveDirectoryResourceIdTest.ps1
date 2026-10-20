[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module Microsoft.PowerShell.Security
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$endpoint = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            ServicePrincipalId = 'Some service principal ID'
            ServicePrincipalKey = 'Some service principal key'
            TenantId = 'Some tenant ID'
        }
        Scheme = 'ServicePrincipal'
    }
    Data = @{
        SubscriptionId = 'Some subscription ID'
        SubscriptionName = 'Some subscription name'
        Environment = "AzureCloud"
        ActiveDirectoryServiceEndpointResourceId = "https://management.windows.azure.com"
    }
}

$variableSets = @(
    @{ environment = "AzureCloud" ; result = "https://management.azure.com/"}
    @{ environment = "AzureStack" ; result = "https://management.windows.azure.com" }
)

foreach ($variableSet in $variableSets) {

    Write-Verbose ('-' * 80)
    $endpoint.Data.Environment = $variableSet.environment

    Unregister-Mock Add-AzureStackDependencyData
    Register-Mock Add-AzureStackDependencyData { return $endpoint }

    # Act.
    $result = & $module Get-AzureActiverDirectoryResourceId -Endpoint $endpoint 

    # Assert.
    Assert-AreEqual $variableSet.result $result
}

