[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1

$endpoint = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
            ServicePrincipalId = 'Service Principal Id 1'
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

Register-Mock Get-VstsWebProxy { }
Register-Mock Add-Tls12InSession { }
Register-Mock Add-AzAccount { 'Add-AzAccount' }
Register-Mock Set-CurrentAzureRMSubscription { 'Set-CurrentAzureRMSubscription' }
Register-Mock Set-UserAgent { }
Register-Mock Add-Certificate { }

$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$result = & $module Initialize-AzureSubscription -Endpoint $endpoint 

Assert-WasCalled Add-AzAccount