[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
& $module { $script:azureRMProfileModule = @{ } }
$endpoint = @{ Auth = @{ Scheme = 'Certificate' } }

Register-Mock Set-UserAgent
# Act/Assert.
Assert-Throws { & $module Initialize-AzureSubscription -Endpoint $endpoint -connectedServiceNameARM "some service name" } -MessagePattern AZ_CertificateAuthNotSupported
