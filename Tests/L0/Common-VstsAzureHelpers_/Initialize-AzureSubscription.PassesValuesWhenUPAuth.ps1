[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module Microsoft.PowerShell.Security
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
$endpoint = @{
    Auth = @{
        Parameters = @{
            UserName = 'Some user name'
            Password = 'Some password'
        }
        Scheme = 'UserNamePassword'
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
        & $module { $script:isClassic = $true ; $script:classicVersion = [version]'1.0' }
    } else {
        & $module { $script:isClassic = $false ; $script:classicVersion = $null }
    }

    # Act.
    $result = & $module Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $variableSet.StorageAccount

    # Assert.
    Assert-AreEqual $null $result
    if ($variableSet.Classic) {
        Assert-WasCalled Add-AzureAccount -ArgumentsEvaluator {
            $args.Length -eq 2 -and
            $args[0] -eq '-Credential' -and
            $args[1] -is [pscredential] -and
            $args[1].UserName -eq 'Some user name' -and
            $args[1].GetNetworkCredential().Password -eq 'Some password'
        }
        Assert-WasCalled Set-CurrentAzureSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId -StorageAccount $variableSet.StorageAccount
    } else {
        Assert-WasCalled Add-AzureRMAccount -ArgumentsEvaluator {
            $args.Length -eq 2 -and
            $args[0] -eq '-Credential' -and
            $args[1] -is [pscredential] -and
            $args[1].UserName -eq 'Some user name' -and
            $args[1].GetNetworkCredential().Password -eq 'Some password'
        }
        Assert-WasCalled Set-CurrentAzureRMSubscription -- -SubscriptionId $endpoint.Data.SubscriptionId
    }
}
