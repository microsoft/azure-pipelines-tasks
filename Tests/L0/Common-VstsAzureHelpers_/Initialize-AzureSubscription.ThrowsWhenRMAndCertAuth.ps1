[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
& $module { $script:isClassic = $false }
$endpoint = @{ Auth = @{ Scheme = 'Certificate' } }

# Act/Assert.
Assert-Throws { & $module Initialize-AzureSubscription -Endpoint $endpoint } -MessagePattern AZ_CertificateAuthNotSupported
