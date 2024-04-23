[CmdletBinding()]
param()

$featureFlags = @{
    retireAzureRM = [System.Convert]::ToBoolean($env:RETIRE_AZURERM_POWERSHELL_MODULE)
}

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
    
    if ($featureFlags.retireAzureRM) {
        try {
            & $module Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $variableSet.StorageAccount
            
            # Fail test if Initialize-AzureSubscription passed with enabled FF
            throw "AzureRM should fail"
        } catch {
            Assert-AreEqual -Expected "AZ_MsiFailure" -Actual $_.Exception.Message -Message "When FF enabled AzureRM should fail"
        }
    } else {
        # Act.
        $result = & $module Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $variableSet.StorageAccount

        Assert-AreEqual $null $result
        Assert-WasCalled Set-CurrentAzureRMSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -TenantId $endpoint.Auth.Parameters.TenantId
    }
}