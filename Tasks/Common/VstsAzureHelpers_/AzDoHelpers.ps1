function Get-AzDOToken {
    
    $connectionServiceName = Get-VstsInput - Name "ConnectedServiceName"

    Write-Host $connectionServiceName

    if ([string]::IsNullOrEmpty($connectionServiceName)) {
        return System.AccessToken
    } 

    $endpoint = Get-VstsEndpoint -Name $connectionServiceName

    Write-Host $endpoint
    
    if ($endpoint.Auth.Scheme -ne 'WorkloadIdentityFederation ') {
        Write-Error 'Connected service is not of type Workload Identity Federation'
        throw
    }

    # Generate Azure access token
    $tokenRequestBody = @{
        resource = "https://management.azure.com/"
        client_id = $endpoint.Auth.Parameters.ClientId
        client_secret = $endpoint.Auth.Parameters.ClientSecret
        grant_type = "client_credentials"
    }

    $TenantId = $endpoint.Auth.Parameters.TenantId
    $ServicePrincipalId = $endpoint.Auth.Parameters.ServicePrincipalId

    $tokenResponse = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$(TenantId)/oauth2/token" -ContentType "application/x-www-form-urlencoded" -Body $tokenRequestBody

    Write-Host $tokenResponse

    $AzureAccessToken = $tokenResponse.access_token

    Write-Host $AzureAccessToken

    Connect-AzAccount -AccessToken $AzureAccessToken -TenantId $TenantId -AccountId $ServicePrincipalId
    $Token = Get-AzAccessToken -ResourceUrl "499b84ac-1321-427f-aa17-267ca6975798"

    Write-Host $Token

    return $Token.token
}