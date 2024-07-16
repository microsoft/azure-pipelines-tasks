[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1

# Mock values
$validEndpoint = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
            ServicePrincipalId = 'Service Principal Id 1'
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

$faultyEndpoint = @{
    Url = "https://management.azure.com"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
            ServicePrincipalId = 'Service Principal Id 2'
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

Register-Mock Get-VstsTaskVariable { "false" } -- -Name "USE_MSAL"
Register-Mock Add-Tls12InSession
Register-Mock Get-EnvironmentAuthUrl { return "https://login.windows.net/" }
Register-Mock Get-AzureActiverDirectoryResourceId { return "https://management.azure.com/" }
Register-Mock ConvertTo-Pfx { return "Drive:\RandomPath", "RandomPfxPassword" }
Register-Mock Get-PfxCertificate { } 

$MicrosoftIdentityModelClientsActiveDirectorySource = @"
    using System;
    using System.Threading.Tasks;

    namespace Microsoft.IdentityModel.Clients.ActiveDirectory {
        public class ClientAssertionCertificate  {
            public bool isValid = true;

            public ClientAssertionCertificate(string servicePrincipalId, System.Security.Cryptography.X509Certificates.X509Certificate2 certificate) {
                
                if (servicePrincipalId == "Service Principal Id 2") {
                    this.isValid = false;
                }
            }
        }

        public class AuthenticationContext {
            public AuthenticationContext(string authorityUrl, bool validateAuthority = true) {
            }

            public Task<AuthenticationResult> AcquireTokenAsync(string resource, ClientAssertionCertificate certificate) {
                if (!certificate.isValid) {
                    throw new Exception("Test Exception thrown");
                }

                return Task.FromResult(new AuthenticationResult());
            }
        }

        public class AuthenticationResult {
            public string AccessTokenType = "Bearer";
            public string AccessToken = "RandomAccessToken";
        }
    }
"@ 

Add-Type -TypeDefinition $MicrosoftIdentityModelClientsActiveDirectorySource -Language CSharp

# Test 1 Get-SpnAccessTokenUsingCertificate should return access token
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$result = & $module Get-SpnAccessTokenUsingCertificate -Endpoint $validEndpoint 

Assert-AreEqual "RandomAccessToken" $result.access_token
Assert-WasCalled Get-EnvironmentAuthUrl -Times 1
Assert-WasCalled Get-AzureActiverDirectoryResourceId -Times 1
Assert-WasCalled ConvertTo-Pfx -Times 1
Assert-WasCalled Get-PfxCertificate -Times 1

# Test 2 Get-SpnAccessTokenUsingCertificate should throw error if ADAL throws exception
Assert-Throws {
    $result = & $module Get-SpnAccessTokenUsingCertificate -Endpoint $faultyEndpoint 
} -MessagePattern "AZ_SPNCertificateAccessTokenFetchFailure*"