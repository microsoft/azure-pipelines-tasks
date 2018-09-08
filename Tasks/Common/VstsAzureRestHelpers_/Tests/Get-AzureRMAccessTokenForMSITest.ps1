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
            TenantId = 'Some tenant ID'
        }
        Scheme = 'ManagedServiceIdentity'
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
)

$content = @"
           {"access_token" : "Dummy Token" }
"@

$response = @{
    Content = $content
    StatusCode = 200
    StatusDescription = 'OK'
};

foreach ($variableSet in $variableSets) {

    Write-Verbose ('-' * 80)
    $endpoint.Data.Environment = $variableSet.environment

    Unregister-Mock Add-AzureStackDependencyData
    Unregister-Mock Invoke-WebRequest
    Register-Mock Add-AzureStackDependencyData { return $endpoint }
    Register-Mock Invoke-WebRequest { $response }

    # Act.
    $result = & $module Get-AzureRMAccessToken -Endpoint $endpoint 

    # Assert.
    Assert-AreEqual "Dummy Token" $result.access_token
}

