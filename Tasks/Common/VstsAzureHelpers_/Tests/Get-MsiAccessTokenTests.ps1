[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Get-VstsWebProxy { }
Register-Mock Add-Tls12InSession { }

$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$endpoint = @{
    Url = "https://management.azure.com/"
    Auth = @{
        Parameters = @{
            TenantId = 'Tenant Id'
        }
        Scheme = 'ManagedServiceIdentity'
    }
    Data = @{
        SubscriptionId = 'Subscription ID'
        SubscriptionName = 'Subscription name'
        Environment = 'AzureCloud'
    }
}

$bearerTokenUri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
$accessToken = "Random access token"

# Test 1 - Get-MsiAccessToken returns correct access token if token fetching api returns 200
Register-Mock Invoke-WebRequest {
	return @{
		StatusCode = 200
		Content = "{`"access_token`": `"$accessToken`"}"
	}
} -ParametersEvaluator { $Uri -eq  $bearerTokenUri }


$result = & $module Get-MsiAccessToken -Endpoint $endpoint 

Assert-WasCalled Invoke-WebRequest -Times 1 -ParametersEvaluator { $Uri -eq $bearerTokenUri }
Assert-AreEqual $accessToken $result

# Test 2 - Get-MsiAccessToken throws error if token fetching api throws error
Unregister-Mock Invoke-WebRequest
Register-Mock Invoke-WebRequest {
	$webExceptionStatus = [System.Net.WebExceptionStatus]::ProtocolError
	$webException = New-Object System.Net.WebException "RandomError", $webExceptionStatus
	throw $webException
} -ParametersEvaluator { $Uri -eq  $bearerTokenUri }

Assert-Throws {
	$result = & $module Get-MsiAccessToken -Endpoint $endpoint 
} -MessagePattern "AZ_MsiAccessTokenFetchFailure ProtocolError RandomError"

Assert-WasCalled Invoke-WebRequest -Times 1 -ParametersEvaluator { $Uri -eq $bearerTokenUri }