[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module Microsoft.PowerShell.Security
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$encryptedToken = ConvertTo-SecureString "test token" -AsPlainText -Force

$endpoint = @{
    Auth = @{
        Parameters = @{
            ServicePrincipalId = 'Some service principal ID'
            TenantId = 'Some tenant ID'
        }
        Scheme = 'WorkloadIdentityFederation'
    }
    Data = @{
        SubscriptionId = 'Some subscription ID'
        SubscriptionName = 'Some subscription name'
    }
}

$content = @"
           {"access_token" : "Dummy Token" }
"@

$response = @{
    Content = $content
    StatusCode = 200
    StatusDescription = 'OK'
};

$variableSets = @(
    @{ StorageAccount = 'Some storage account' }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Connect-AzAccount
    Unregister-Mock Set-CurrentAzSubscription
    Unregister-Mock Invoke-WebRequest
    Unregister-Mock Set-UserAgent
    Unregister-Mock Get-VstsFederatedToken
    Unregister-Mock Clear-AzContext
    Register-Mock Connect-AzAccount { '' }
    Register-Mock Set-CurrentAzSubscription
    Register-Mock Set-UserAgent
    Register-Mock Invoke-WebRequest { $response }
    Register-Mock Get-VstsFederatedToken { "some jwt token" }
    Register-Mock Clear-AzContext

    # Act.
    $result = & $module Initialize-AzSubscription -Endpoint $endpoint -connectedServiceNameARM 'Some connected service name' -vstsAccessToken $encryptedToken

    Assert-AreEqual $null $result
    Assert-WasCalled Set-CurrentAzSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -TenantId $endpoint.Auth.Parameters.TenantId
}