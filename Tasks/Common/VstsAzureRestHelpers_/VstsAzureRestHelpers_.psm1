# Private module-scope variables.
$script:azureUri = "https://management.core.windows.net"
$script:azureRmUri = "https://management.azure.com"
$script:jsonContentType = "application/json;charset=utf-8"
$script:formContentType = "application/x-www-form-urlencoded;charset=utf-8"

# Override the DebugPreference.
if ($global:DebugPreference -eq 'Continue') {
    Write-Verbose '$OVERRIDING $global:DebugPreference from ''Continue'' to ''SilentlyContinue''.'
    $global:DebugPreference = 'SilentlyContinue'
}

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

function Get-ProxyUri
{
    param([String] [Parameter(Mandatory=$true)] $serverUrl)

    $proxyUri = [Uri]$null
    $proxy = [System.Net.WebRequest]::GetSystemWebProxy()

    if ($proxy)
    {
        $proxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
        $proxyUri = $proxy.GetProxy("$serverUrl")
    }

    return $proxyUri
}

# Get the Bearer Access Token from the Endpoint
function Get-SpnAccessToken {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)] $endpoint)

    $principalId = $endpoint.Auth.Parameters.ServicePrincipalId
    $tenantId = $endpoint.Auth.Parameters.TenantId
    $principalKey = $endpoint.Auth.Parameters.ServicePrincipalKey
    
    # Prepare contents for POST
    $method = "POST"
    $authUri = "https://login.windows.net/$tenantId/oauth2/token"
    $body = @{
        resource=$script:azureUri+"/"
        client_id=$principalId
        grant_type='client_credentials'
        client_secret=$principalKey
    }
    
    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token"
    
    try
    {
        $proxyUri = Get-ProxyUri $authUri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $authUri))
        {
            Write-Verbose "No proxy settings"
            $accessToken = Invoke-RestMethod -Uri $authUri -Method $method -Body $body -ContentType $script:formContentType
            return $accessToken
        }
        else
        {
            Write-Verbose "Using Proxy settings"
            $accessToken = Invoke-RestMethod -Uri $authUri -Method $method -Body $body -ContentType $script:formContentType -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            return $accessToken
        }
    }
    catch
    {
        throw (Get-VstsLocString -Key AZ_BearerTokenFetchFailure -ArgumentList $tenantId)
    }
}

# Get the certificate from the Endpoint.
function Get-Certificate {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)] $endpoint)

    $bytes = [System.Convert]::FromBase64String($endpoint.Auth.Parameters.Certificate)
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $certificate.Import($bytes)

    return $certificate
}

function Get-AzStorageKeys
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $storageAccountName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)
    
    try
    {
        $subscriptionId = $endpoint.Data.SubscriptionId

        $uri="$script:azureUri/$subscriptionId/services/storageservices/$storageAccountName/keys"
        $headers = @{"x-ms-version"="2016-03-01"}
        $method="GET"

        $certificate = Get-Certificate $endpoint

        $proxyUri = Get-ProxyUri $uri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
            Write-Verbose "No Proxy settings"
            return $storageKeys.StorageService.StorageServiceKeys
        }
        else
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
            return $storageKeys.StorageService.StorageServiceKeys
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzRMStorageKeys
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
          [String] [Parameter(Mandatory = $true)] $storageAccountName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    try
    {
        $accessToken = Get-SpnAccessToken $endpoint

        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method = "POST"
        $uri = "$script:azureRmUri$resourceGroupId/providers/Microsoft.Storage/storageAccounts/$storageAccountName/listKeys" + '?api-version=2015-06-15'

        $headers = @{"x-ms-client-request-id"="d5b6a13d-7fa4-43fd-b912-a83a37221815"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No Proxy settings"
            return $storageKeys
        }
        else
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
            return $storageKeys
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzRmVmCustomScriptExtension
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
          [String] [Parameter(Mandatory = $true)] $vmName,
          [String] [Parameter(Mandatory = $true)] $Name,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    try
    {
        $accessToken = Get-SpnAccessToken $endpoint
        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method="GET"
        $uri = "$script:azureRmUri$resourceGroupId/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name" + '?api-version=2016-03-30'

        $headers = @{"x-ms-client-request-id"="5cbea21e-5ef3-41a1-ad99-38f877af3f93"}
        $headers.Add("accept-language", "en-US")
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $customScriptExt=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No proxy settings"
            return $customScriptExt
        }
        else
        {
            $customScriptExt=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using proxy settings"
            return $customScriptExt
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Remove-AzRmVmCustomScriptExtension
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
          [String] [Parameter(Mandatory = $true)] $vmName,
          [String] [Parameter(Mandatory = $true)] $Name,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    try
    {
        $accessToken = Get-SpnAccessToken $endpoint
        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method="DELETE"
        $uri = "$script:azureRmUri$resourceGroupId/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name" + '?api-version=2016-03-30'

        $headers = @{"x-ms-client-request-id"="f6c57f61-2003-4b56-a34c-d8d41a345f2d"}
        $headers.Add("accept-language", "en-US")
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $response=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No proxy settings"
            return $response
        }
        else
        {
            $response=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using proxy settings"
            return $response
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzStorageAccount
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $storageAccountName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    try
    {
        $subscriptionId = $endpoint.Data.SubscriptionId

        $uri="$script:azureUri/$subscriptionId/services/storageservices/$storageAccountName"
        $headers = @{"x-ms-version"="2016-03-01"}
        $method="GET"

        $certificate = Get-Certificate $endpoint

        $proxyUri = Get-ProxyUri $uri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $storageAccount=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
            Write-Verbose "No Proxy settings"
            return $storageAccount.StorageService.StorageServiceProperties
        }
        else
        {
            $storageAccount=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
            return $storageAccount.StorageService.StorageServiceProperties
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzRmStorageAccount
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
          [String] [Parameter(Mandatory = $true)] $storageAccountName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    try
    {
        $accessToken = Get-SpnAccessToken $endpoint
        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method="GET"
        $uri = "$script:azureRmUri$resourceGroupId/providers/Microsoft.Storage/storageAccounts/$storageAccountName" + '?api-version=2016-01-01'

        $headers = @{"x-ms-client-request-id"="a21c4b0a-2226-4ab5-a473-e39459e6369a"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $storageAccountUnformatted = $null
        $proxyUri = Get-ProxyUri $uri
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $storageAccountUnformatted=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No Proxy settings"
        }
        else
        {
            $storageAccountUnformatted=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
        }

        $storageAccount = New-Object -TypeName PSObject
        $storageAccount | Add-Member -type NoteProperty -name id -value $storageAccountUnformatted.id
        $storageAccount | Add-Member -type NoteProperty -name kind -value $storageAccountUnformatted.kind
        $storageAccount | Add-Member -type NoteProperty -name location -value $storageAccountUnformatted.location
        $storageAccount | Add-Member -type NoteProperty -name StorageAccountName -value $storageAccountUnformatted.name
        $storageAccount | Add-Member -type NoteProperty -name tags -value $storageAccountUnformatted.tags
        $storageAccount | Add-Member -type NoteProperty -name sku -value $storageAccountUnformatted.sku
        $storageAccount | Add-Member -type NoteProperty -name creationTime -value $storageAccountUnformatted.properties.creationTime
        $storageAccount | Add-Member -type NoteProperty -name primaryLocation -value $storageAccountUnformatted.properties.primaryLocation
        $storageAccount | Add-Member -type NoteProperty -name provisioningState -value $storageAccountUnformatted.properties.provisioningState
        $storageAccount | Add-Member -type NoteProperty -name statusOfPrimary -value $storageAccountUnformatted.properties.statusOfPrimary
        $storageAccount | Add-Member -type NoteProperty -name primaryEndpoints -value $storageAccountUnformatted.properties.primaryEndpoints

        return $storageAccount
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzRmResourceGroup
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    try
    {
        $accessToken = Get-SpnAccessToken $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId

        $method="GET"
        $uri = "$script:azureRmUri/subscriptions/$subscriptionId/resourceGroups" + '?api-version=2016-02-01'

        $headers = @{"x-ms-client-request-id"="f18eb0d7-20c2-44b9-af30-21dab6afbcde"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        $resourceGroups=$null
        
        if (($proxyUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $null) -or ($proxyUri.AbsoluteUri -eq $uri))
        {
            $resourceGroups=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No Proxy settings"
        }
        else
        {
            $resourceGroups=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
        }
        foreach ($resourceGroup in $resourceGroups.value)
        {
            if ($resourceGroup.name -eq $resourceGroupName)
            {
                return $resourceGroup
            }
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

# Export only the public function.
Export-ModuleMember -Function Add-AzureSqlDatabaseServerFirewallRule
Export-ModuleMember -Function Remove-AzureSqlDatabaseServerFirewallRule
Export-ModuleMember -Function Get-AzStorageKeys
Export-ModuleMember -Function Get-AzRMStorageKeys
Export-ModuleMember -Function Get-AzRmVmCustomScriptExtension
Export-ModuleMember -Function Remove-AzRmVmCustomScriptExtension
Export-ModuleMember -Function Get-AzStorageAccount
Export-ModuleMember -Function Get-AzRmStorageAccount
Export-ModuleMember -Function Get-AzRmResourceGroup