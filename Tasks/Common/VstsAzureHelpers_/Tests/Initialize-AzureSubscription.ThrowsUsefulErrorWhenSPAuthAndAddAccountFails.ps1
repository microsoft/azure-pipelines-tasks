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
        Scheme = 'ServicePrincipal'
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
    Unregister-Mock Set-UserAgent
    Register-Mock Add-AzureAccount { throw 'Some add account error' }
    Register-Mock Add-AzureRMAccount { throw 'Some add account error' }
    Register-Mock Write-VstsTaskError
    Register-Mock Set-UserAgent
    if ($variableSet.Classic) {
        & $module {
            $script:azureModule = @{ Version = [version]'0.9.8' }
            $script:azureRMProfileModule = $null
        }
    } else {
        & $module {
            $script:azureModule = $null
            $script:azureRMProfileModule = @{ Version = [version]'1.2.3.4' }
        }
    }

    # Act/Assert.
    Assert-Throws {
        & $module Initialize-AzureSubscription -Endpoint $endpoint
    } -MessagePattern AZ_ServicePrincipalError

    # Assert.
    if ($variableSet.Classic) {
        Assert-WasCalled Write-VstsTaskError -- -Message 'Some add account error'
        Assert-WasCalled Add-AzureAccount
    } elseif (-not $featureFlags.retireAzureRM){
        Assert-WasCalled Write-VstsTaskError -- -Message 'Some add account error'
        Assert-WasCalled Add-AzureRMAccount
    }
}
