[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module Microsoft.PowerShell.Security
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
$endpoint = @{
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
$variableSets = @(
    @{ Classic = $true ; StorageAccount = $null }
    @{ Classic = $true ; StorageAccount = 'Some storage account' }
    @{ Classic = $false ; StorageAccount = $null }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Add-AzureAccount
    Unregister-Mock Add-AzureRMAccount
    Unregister-Mock Set-CurrentAzureSubscription
    Unregister-Mock Set-CurrentAzureRMSubscription
    Register-Mock Add-AzureAccount { 'some output' }
    Register-Mock Add-AzureRMAccount { 'some output' }
    Register-Mock Set-CurrentAzureSubscription
    Register-Mock Set-CurrentAzureRMSubscription
    if ($variableSet.Classic) {
        & $module { $script:isClassic = $true ; $script:classicVersion = [version]'0.9.8' }
    } else {
        & $module { $script:isClassic = $false ; $script:classicVersion = $null }
    }

    # Act.
    $result = & $module Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $variableSet.StorageAccount

    # Assert.
    Assert-AreEqual $null $result
    if ($variableSet.Classic) {
        Assert-WasCalled Add-AzureAccount -ArgumentsEvaluator {
            $args.Length -eq 5 -and
            $args[0] -eq '-ServicePrincipal' -and
            $args[1] -eq '-Tenant' -and
            $args[2] -eq 'Some tenant ID' -and
            $args[3] -eq '-Credential' -and
            $args[4] -is [pscredential] -and
            $args[4].UserName -eq 'Some service principal ID' -and
            $args[4].GetNetworkCredential().Password -eq 'Some service principal key'
        }
        Assert-WasCalled Set-CurrentAzureSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -StorageAccount $variableSet.StorageAccount
    } else {
        Assert-WasCalled Add-AzureRMAccount -ArgumentsEvaluator {
            $args.Length -eq 5 -and
            $args[0] -eq '-ServicePrincipal' -and
            $args[1] -eq '-Tenant' -and
            $args[2] -eq 'Some tenant ID' -and
            $args[3] -eq '-Credential' -and
            $args[4] -is [pscredential] -and
            $args[4].UserName -eq 'Some service principal ID' -and
            $args[4].GetNetworkCredential().Password -eq 'Some service principal key'
        }
        Assert-WasCalled Set-CurrentAzureRMSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -TenantId $endpoint.Auth.Parameters.TenantId
    }
}
