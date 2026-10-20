[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$variableSets = @(
    @{
        SubscriptionId = 'Some subscription ID'
        TenantId = $null
    }
    @{
        SubscriptionId = 'Some subscription ID'
        TenantId = 'Some tenant ID'
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Select-AzureRMSubscription
    Register-Mock Select-AzureRMSubscription

    # Act.
    & $module Set-CurrentAzureRMSubscription -SubscriptionId $variableSet.SubscriptionId -TenantId $variableSet.TenantId

    # Assert.
    if ($variableSet.TenantId) {
        # The TenantId parameter ends in ":" for the assertion because it's splatted. 
        Assert-WasCalled Select-AzureRMSubscription -- -SubscriptionId $variableSet.SubscriptionId -TenantId: $variableSet.TenantId
    } else {
        Assert-WasCalled Select-AzureRMSubscription -- -SubscriptionId $variableSet.SubscriptionId
    }
}
