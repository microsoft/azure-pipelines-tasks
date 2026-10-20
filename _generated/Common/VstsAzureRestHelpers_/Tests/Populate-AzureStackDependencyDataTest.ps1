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
    }
}

Write-Verbose ('-' * 80)
$endpointDataResponse = @{
    "galleryEndpoint" = "https://gallery.azure.com";
    "graphEndpoint" = "https://graph.windows.net/";
    "portalEndpoint" = "https://portal.azure.com"
    "authentication" = @{
        "loginEndpoint" = "https://login.windows.net";
        "audiences"= @("https://management.azure.com")
    }
}
Unregister-Mock Invoke-RestMethod
Register-Mock Invoke-RestMethod { return $endpointDataResponse }

# Act.
$result = & $module Add-AzureStackDependencyData -Endpoint $endpoint 

# Assert.
Assert-AreEqual "https://gallery.azure.com" $result.Data.galleryUrl
Assert-AreEqual "https://management.azure.com" $result.Data.resourceManagerUrl
Assert-AreEqual "https://login.windows.net/" $result.Data.activeDirectoryAuthority
Assert-AreEqual "https://login.windows.net/" $result.Data.environmentAuthorityUrl
Assert-AreEqual "https://graph.windows.net/" $result.Data.graphUrl
Assert-AreEqual "https://management.azure.com" $result.Data.activeDirectoryServiceEndpointResourceId
Assert-AreEqual "vault.azure.com" $result.Data.AzureKeyVaultDnsSuffix
    

