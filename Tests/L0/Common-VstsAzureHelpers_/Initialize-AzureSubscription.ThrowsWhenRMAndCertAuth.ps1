[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
& $module { $script:azureRMProfileModule = @{ } }
$endpoint = @{ Auth = @{ Scheme = 'Certificate' } }

Register-Mock Set-UserAgent
# Act/Assert.
Assert-Throws { & $module Initialize-AzureSubscription -Endpoint $endpoint } -MessagePattern AZ_CertificateAuthNotSupported
