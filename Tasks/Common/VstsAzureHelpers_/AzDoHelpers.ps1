function Get-AzDOToken()
{
    $connectionServiceName = $env:AZURESUBSCRIPTION_SERVICE_CONNECTION_ID
    $servicePrincipalId = $env:AZURESUBSCRIPTION_CLIENT_ID
    $tenantId = $env:AZURESUBSCRIPTION_TENANT_ID
    $activeDirectoryAuthority = "https://login.microsoftonline.com/$tenantId/"
    $vstsAccessToken = $env:VSTS_ACCESS_TOKEN
    $scheme = "WorkloadIdentityFederation"

    if ($null -eq $connectionServiceName -or $connectionServiceName -eq "") {
        Write-Host "Returning System.AccessToken"
        return System.AccessToken
    }

    $accessToken = @{
        token_type = $null
        access_token = $null
        expires_on = $null
    }

    Import-Module $PSScriptRoot/../../ps_modules/VstsAzureRestHelpers_ -Force

    $parameters = @{
        TenantId = $tenantId
        ServicePrincipalId = $servicePrincipalId
    }

    $auth = @{
        Scheme = $scheme 
        Parameters = $parameters
    }

    $data = @{
        activeDirectoryAuthority = $activeDirectoryAuthority
    }

    $vstsEndpoint = @{
        Auth = $auth
        Data = $data
    }

    $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
        -connectedServiceNameARM $connectionServiceName `
        -scope "499b84ac-1321-427f-aa17-267ca6975798" `
        -vstsAccessToken $vstsAccessToken

    $accessToken.token_type = $result.TokenType
    $accessToken.access_token = $result.AccessToken
    $accessToken.expires_on = $result.ExpiresOn.ToUnixTimeSeconds()

    Write-Host "Get-connectionServiceNameAccessToken: Received accessToken";

    return $accessToken;
}