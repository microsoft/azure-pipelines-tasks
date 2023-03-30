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
        Version = [version]'1.0'
        StorageAccount = $null
        ExpectDefaultSwitch = $false
    }
    @{
        SubscriptionId = 'Some subscription ID'
        Version = [version]'0.8.14'
        StorageAccount = $null
        ExpectDefaultSwitch = $true
    }
    @{
        SubscriptionId = 'Some subscription ID'
        Version = [version]'1.0'
        StorageAccount = 'Some storage account'
        ExpectDefaultSwitch = $false
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Select-AzureSubscription
    Unregister-Mock Set-AzureSubscription
    Register-Mock Select-AzureSubscription
    Register-Mock Set-AzureSubscription
    & $module { $script:azureModule = @{ Version = $args[0] } } $variableSet.Version

    # Act.
    & $module Set-CurrentAzureSubscription -SubscriptionId $variableSet.SubscriptionId -StorageAccount $variableSet.StorageAccount

    # Assert.
    if ($variableSet.ExpectDefaultSwitch) {
        Assert-WasCalled Select-AzureSubscription -- -SubscriptionId $variableSet.SubscriptionId -Default: $true
    } else {
        Assert-WasCalled Select-AzureSubscription -- -SubscriptionId $variableSet.SubscriptionId
    }

    if ($variableSet.StorageAccount) {
        Assert-WasCalled Set-AzureSubscription -- -SubscriptionId $variableSet.SubscriptionId -CurrentStorageAccountName $variableSet.StorageAccount
    } else {
        Assert-WasCalled Set-AzureSubscription -Times 0
    }
}
<#
function Set-CurrentAzureRMSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$TenantId)

    $additional = @{ }
    if ($TenantId) { $additional['TenantId'] = $TenantId }
    Write-Host "##[command]Select-AzureRMSubscription -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Select-AzureRMSubscription -SubscriptionId $SubscriptionId @additional
}
#>