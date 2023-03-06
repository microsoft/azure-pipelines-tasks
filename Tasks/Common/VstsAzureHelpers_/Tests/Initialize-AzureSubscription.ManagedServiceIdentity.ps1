[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module Microsoft.PowerShell.Security
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$endpoint = @{
    Auth = @{
        Parameters = @{
            ServicePrincipalId = 'Some service principal ID'
            ServicePrincipalKey = 'Some service principal key'
            TenantId = 'Some tenant ID'
        }
        Scheme = 'ManagedServiceIdentity'
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
    Unregister-Mock Add-AzureRMAccount
    Unregister-Mock Set-CurrentAzureRMSubscription
    Unregister-Mock Invoke-WebRequest
    Unregister-Mock Set-UserAgent
    Register-Mock Add-AzureRMAccount { 'some output' }
    Register-Mock Set-CurrentAzureRMSubscription
    Register-Mock Set-UserAgent
    Register-Mock Invoke-WebRequest { $response }
    
    # Act.
    $result = & $module Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $variableSet.StorageAccount -connectedServiceNameARM "Some sevice name"

    Assert-AreEqual $null $result
    Assert-WasCalled Set-CurrentAzureRMSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -TenantId $endpoint.Auth.Parameters.TenantId
}