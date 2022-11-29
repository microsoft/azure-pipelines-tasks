[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1

# Mock values
$endpointWithSPNKey = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
            ServicePrincipalId = 'Service Principal Id'
            AuthenticationType = 'SPNKey'
            ServicePrincipalKey = 'Service Principal Key'
        }
        Scheme = 'ServicePrincipal'
    }
    Data = @{
        SubscriptionId = 'Subscription ID'
        SubscriptionName = 'Subscription name'
        Environment = "AzureCloud"
        ActiveDirectoryServiceEndpointResourceId = "https://management.azure.com"
    }
}

$endpointWithSPNCertificate = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
            ServicePrincipalId = 'Service Principal Id'
            AuthenticationType = 'SPNCertificate'
            ServicePrincipalCertificate = 'Service Principal Certificate'
        }
        Scheme = 'ServicePrincipal'
    }
    Data = @{
        SubscriptionId = 'Subscription ID'
        SubscriptionName = 'Subscription name'
        Environment = "AzureCloud"
        ActiveDirectoryServiceEndpointResourceId = "https://management.azure.com"
    }
}

$endpointWithMSIScheme = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
        }
        Scheme = 'ManagedServiceIdentity'
    }
    Data = @{
        SubscriptionId = 'Subscription Id'
        SubscriptionName = 'Subscription Name'
        Environment = "AzureCloud"
        ActiveDirectoryServiceEndpointResourceId = "https://management.windows.azure.com"
    }
}

Register-Mock Add-Tls12InSession
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# Test 1
Register-Mock Get-SpnAccessToken { }

$result = & $module Get-AzureRmAccessToken -Endpoint $endpointWithSPNKey -UseMSAL $false

Assert-WasCalled Get-SpnAccessToken -Times 1

# Test 2
Register-Mock Get-SpnAccessTokenUsingCertificate { }

$result = & $module Get-AzureRmAccessToken -Endpoint $endpointWithSPNCertificate -UseMSAL $false

Assert-WasCalled Get-SpnAccessTokenUsingCertificate -Times 1

# Test 3
Register-Mock Get-MsiAccessToken { }

$result = & $module Get-AzureRmAccessToken -Endpoint $endpointWithMSIScheme

Assert-WasCalled Get-MsiAccessToken -Times 1

# Test 4 - MSAL case
$resultMSAL = @{
    TokenType = "Bearer";
    AccessToken = "AccessToken";
    ExpiresOn = [System.DateTimeOffset]::Now;
}

Register-Mock Get-AccessTokenMSAL { $resultMSAL }

$result = & $module Get-AzureRmAccessToken -Endpoint $endpointWithSPNKey

Assert-WasCalled Get-AccessTokenMSAL -Times 1