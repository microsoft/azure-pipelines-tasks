[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
& $module { $script:azureRMProfileModule = @{ } }
$endpoint = @{ Auth = @{ Scheme = 'Certificate' } }

Register-Mock Set-UserAgent
# Act/Assert.
Assert-Throws { & $module Initialize-AzureSubscription -Endpoint $endpoint } -MessagePattern AZ_CertificateAuthNotSupported
