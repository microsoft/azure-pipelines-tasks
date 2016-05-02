[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
$endpoint = @{
    Auth = @{
        Parameters = @{
            ServicePrincipalId = 'Some service principal ID'
            ServicePrincipalKey = 'Some service principal key'
            TenantId = 'Some tenant ID'
        }
        Scheme = 'Some unknown scheme'
    }
    Data = @{
        SubscriptionId = 'Some subscription ID'
        SubscriptionName = 'Some subscription name'
    }
}

# Act/Assert.
Assert-Throws {
    & $module Initialize-AzureSubscription -Endpoint $endpoint
} -MessagePattern "AZ_UnsupportedAuthScheme0 Some unknown scheme"
