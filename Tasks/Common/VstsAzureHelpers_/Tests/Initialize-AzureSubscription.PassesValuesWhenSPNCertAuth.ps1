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
Register-Mock Add-AzureRMAccount { 'Add-AzureRmAccount' }
Register-Mock Set-CurrentAzureRMSubscription { 'Set-CurrentAzureRMSubscription' }
Register-Mock Set-UserAgent { }
Register-Mock Add-Certificate { }

$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
& $module {
$script:azureModule = $null
$script:azureRMProfileModule = @{ Version = [version]'1.2.3.4' }
}

$result = & $module Initialize-AzureSubscription -Endpoint $endpoint -connectedServiceNameARM "some service name"

Assert-WasCalled Add-AzureRMAccount