[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
& $module { $script:azureModule = @{ Version = [version]'1.0' } }
$endpoint = @{
    Auth = @{
        Scheme = 'Certificate'
    }
    Data = @{
        SubscriptionId = 'Some subscription ID'
        SubscriptionName = 'Some subscription name'
    }
}
$certificate = 'Some certificate'
$variableSets = @(
    @{ StorageAccount = $null }
    @{ StorageAccount = 'Some storage account' }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Add-Certificate
    Unregister-Mock Set-AzureSubscription
    Unregister-Mock Set-CurrentAzureSubscription
    Unregister-Mock Set-UserAgent
    Register-Mock Add-Certificate { $certificate }
    Register-Mock Set-AzureSubscription
    Register-Mock Set-CurrentAzureSubscription
    Register-Mock Set-UserAgent

    # Act.
    & $module Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $variableSet.StorageAccount

    # Assert.
    Assert-WasCalled Add-Certificate -- -Endpoint $endpoint
    if ($variableSet.StorageAccount) {
        # The CurrentStorageAccountName parameter ends in ":" for the assertion because it's splatted. 
        Assert-WasCalled Set-AzureSubscription -- -SubscriptionName $endpoint.Data.SubscriptionName -SubscriptionId $endpoint.Data.SubscriptionId -Certificate $certificate -Environment AzureCloud -CurrentStorageAccountName: $variableSet.StorageAccount
    } else {
        Assert-WasCalled Set-AzureSubscription -- -SubscriptionName $endpoint.Data.SubscriptionName -SubscriptionId $endpoint.Data.SubscriptionId -Certificate $certificate -Environment AzureCloud
    }

    Assert-WasCalled Set-CurrentAzureSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -StorageAccount $variableSet.StorageAccount
}
