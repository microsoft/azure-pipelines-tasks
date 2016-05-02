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
    @{ Classic = $true }
    @{ Classic = $false }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Add-AzureAccount
    Unregister-Mock Add-AzureRMAccount
    Unregister-Mock Write-VstsTaskError
    Register-Mock Add-AzureAccount { throw 'Some add account error' }
    Register-Mock Add-AzureRMAccount { throw 'Some add account error' }
    Register-Mock Write-VstsTaskError
    if ($variableSet.Classic) {
        & $module { $script:isClassic = $true ; $script:classicVersion = [version]'0.9.8' }
    } else {
        & $module { $script:isClassic = $false ; $script:classicVersion = $null }
    }

    # Act/Assert.
    Assert-Throws {
        & $module Initialize-AzureSubscription -Endpoint $endpoint
    } -MessagePattern AZ_CredentialsError

    # Assert.
    Assert-WasCalled Write-VstsTaskError -- -Message 'Some add account error'
    if ($variableSet.Classic) {
        Assert-WasCalled Add-AzureAccount
    } else {
        Assert-WasCalled Add-AzureRMAccount
    }
}
