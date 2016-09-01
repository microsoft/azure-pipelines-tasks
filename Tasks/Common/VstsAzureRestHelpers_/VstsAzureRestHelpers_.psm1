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

# Get connection Type
function Get-ConnectionType
{
    param([Object] [Parameter(Mandatory=$true)] $serviceEndpoint)

    $connectionType = $serviceEndpoint.Auth.Scheme

    Write-Verbose "Connection type used is $connectionType"
    return $connectionType
}

# Get the Bearer Access Token from the Endpoint
function Get-UsernamePasswordAccessToken {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)] $Endpoint)

    # Well known Client-Id
    $clientId = "1950a258-227b-4e31-a9cf-717495945fc2"
    $password = $endpoint.Auth.Parameters.Password
    $username = $endpoint.Auth.Parameters.UserName
    $tenantId = "common"

    $method = "POST"
    $authUri = "https://login.microsoftonline.com/$tenantId/oauth2/token"
    $body = @{
        resource=$script:azureUri
        client_id=$clientId
        grant_type='password'
        username=$username
        password=$password
    }

    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token" -Verbose

    try {
        $accessToken = Invoke-RestMethod -Uri $authUri -Method $method -Body $body -ContentType $script:formContentType
        return $accessToken
    }
    catch
    {
        throw (Get-VstsLocString -Key AZ_BearerTokenFetchFailure -ArgumentList $tenantId)
    }
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
        resource=$script:azureUri
        client_id=$principalId
        grant_type='client_credentials'
        client_secret=$principalKey
    }
    
    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token" -Verbose

    try
    {
        $proxyUri = Get-ProxyUri $authUri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $authUri))
        {
            $accessToken = (Invoke-RestMethod -Uri $authUri -Method $method -Body $body -ContentType $script:formContentType)
            return $accessToken
        }
        else
        {
            $accessToken = (Invoke-RestMethod -Uri $authUri -Method $method -Body $body -ContentType $script:formContentType) -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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

# Removed now. Keeping it here to Illustrate how the Credential Method was tried.
# Get the Credential from the end point
#function Get-PsCredential {
#    [CmdletBinding()]
#    param([Parameter(Mandatory=$true)] $endpoint)
#
#    $password = ConvertTo-SecureString $endpoint.Auth.Parameters.password -AsPlainText -Force
#    $psCredentials = New-Object System.Management.Automation.PSCredential($endpoint.Auth.Parameters.username, $password)
#    
#    return $psCredentials
#}

# Get the Azure Resource Id
function Get-AzResource
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceName,
          [String] [Parameter(Mandatory = $true)] $resourceType,#ex:"Microsoft.Sql/servers"
          [Object] [Parameter(Mandatory = $true)] $endpoint,
          [Object] [Parameter(Mandatory = $true)] $accessToken,
          [String] [Parameter(Mandatory = $true)] $apiVersion)#####################check if api-version will change depending on resource

    try
    {
        $subscriptionId = $endpoint.Data.SubscriptionId
        
        Write-Verbose "[Azure Rest Call] Get Resource Groups"
        $method = "GET"
        $uri = "$script:azureRmUri/subscriptions/$subscriptionId/resources?api-version=2016-07-01"
        $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

        $ResourceDetails = (Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType)
        foreach ($resourceDetail in $ResourceDetails.Value)
        {
            if ($resourceDetail.name -eq $resourceName -and $resourceDetail.type -eq $resourceType)
            {
                return $resourceDetail.id
            }
        }
        Write-Error "No Valid Resource of ServerName : $resourceName , ServerType : $resourceType Found for Subscription $subscriptionId"
        throw

    }
    catch 
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzureSqlDatabaseServerResourceId
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [Object] [Parameter(Mandatory = $true)] $endpoint,
          [Object] [Parameter(Mandatory = $true)] $accessToken)

    try
    {
        $serverType = "Microsoft.Sql/servers"
        $subscriptionId = $endpoint.Data.SubscriptionId
        
        Write-Verbose "[Azure Rest Call] Get Resource Groups"
        $method = "GET"
        $uri = "$script:azureRmUri/subscriptions/$subscriptionId/resources?api-version=2016-07-01"
        $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

        $ResourceDetails = (Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType)
        foreach ($resourceDetail in $ResourceDetails.Value)
        {
            if ($resourceDetail.name -eq $serverName -and $resourceDetail.type -eq $serverType)
            {
                return $resourceDetail.id
            }
        }
        Write-Error "No Valid Resource of ServerName : $serverName , ServerType : $serverType Found for Subscription $subscriptionId"
        throw

    }
    catch 
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Add-AzureSqlDatabaseServerFirewallRule
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $startIPAddress,
          [String] [Parameter(Mandatory = $true)] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)
    
    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId
    
        if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
        {
            $method = "POST"
            $uri = "$script:azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules"
    
            $body = @{
                Name=$firewallRuleName
                StartIPAddress=$startIPAddress
                EndIPAddress=$endIPAddress
                }
            $body = $body | ConvertTo-JSON
            $headers = @{"x-ms-version"="2014-04-01"}

            # Get Certificate or bearer token and call Rest API
            if($connectionType -eq 'Certificate')
            {
                $certificate = Get-Certificate $endpoint
                Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body -Certificate $certificate -ContentType $script:jsonContentType
            }
            else
            {
                $accessToken = Get-UsernamePasswordAccessToken $endpoint
                $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

                Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body -ContentType $script:jsonContentType
            }
            
        }
        elseif ($connectionType -eq 'ServicePrincipal')
        {
            $accessToken = Get-SpnAccessToken $endpoint
            
            # get azure sql server resource Id
            $azureResourceId = Get-AzureSqlDatabaseServerResourceId -endpoint $endpoint -serverName $serverName -accessToken $accessToken
            
            $method = "PUT"
            $uri = "$script:azureRmUri/$azureResourceId/firewallRules/$firewallRuleName\?api-version=2014-04-01"
            $body = "{
                    'properties' : {
                        'startIpAddress':'$startIPAddress',
                        'endIpAddress':'$endIPAddress'
                    }
            }"
            
            $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}
            Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body -ContentType $script:jsonContentType
            
        }
        else {
            throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
        }
    }
    catch
    {
        Write-Host "Exception Message: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

function Remove-AzureSqlDatabaseServerFirewallRule
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId

        $method = "DELETE"
        if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
        {
            $uri = "$script:azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules/$firewallRuleName"
            $headers = @{"x-ms-version"="2014-04-01"}

            # Get Certificate or PS Credential & Call Invoke
            if($connectionType -eq 'Certificate')
            {
                $certificate = Get-Certificate $endpoint
                Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
            }
            else
            {
                $accessToken = Get-UsernamePasswordAccessToken $endpoint
                $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

                Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            }
        }
        else
        {
            $accessToken = Get-SpnAccessToken $endpoint
            
            # Fetch Azure SQL server resource Id
            $azureResourceId = Get-AzureSqlDatabaseServerResourceId -endpoint $endpoint -serverName $serverName -accessToken $accessToken

            $uri = "$script:azureRmUri/$azureResourceId/firewallRules/$firewallRuleName\?api-version=2014-04-01"
            $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}
            
            Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage"
        throw
    }
}

function Get-AzStorageKeys
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $storageAccountName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)
    
    try
    {
        $connectionType=Get-ConnectionType $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId

        $uri="$script:azureUri/$subscriptionId/services/storageservices/$storageAccountName/keys"
        $headers = @{"x-ms-version"="2016-03-01"}
        $method="GET"

        $certificate = Get-Certificate $endpoint

        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
            return $storageKeys
        }
        else
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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
        $method = "POST"
        $uri = "$script:azureRmUri$resourceGroupDetails.id/providers/Microsoft.Storage/storageAccounts/$storageAccountName/listKeys?api-version=2015-06-15"

        $headers = @{"x-ms-client-request-id"="d5b6a13d-7fa4-43fd-b912-a83a37221815"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            return $storageKeys
        }
        else
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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

        $method="GET"
        $uri = "$script:azureRmUri$resourceGroupDetails.id/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name?api-version=2016-03-30"

        $headers = @{"x-ms-client-request-id"="5cbea21e-5ef3-41a1-ad99-38f877af3f93"}
        $headers.Add("accept-language", "en-US")
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $customScriptExt=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            return $customScriptExt
        }
        else
        {
            $customScriptExt=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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

        $method="DELETE"
        $uri = "$script:azureRmUri$resourceGroupDetails.id/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name?api-version=2016-03-30"

        $headers = @{"x-ms-client-request-id"="f6c57f61-2003-4b56-a34c-d8d41a345f2d"}
        $headers.Add("accept-language", "en-US")
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $response=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            return $response
        }
        else
        {
            $response=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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
        $connectionType=Get-ConnectionType $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId

        $uri="$script:azureUri/$subscriptionId/services/storageservices/$storageAccountName/keys"
        $headers = @{"x-ms-version"="2016-03-01"}
        $method="GET"

        $certificate = Get-Certificate $endpoint

        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
            return $storageKeys
        }
        else
        {
            $storageKeys=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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

        $method="GET"
        $uri = "$script:azureRmUri$resourceGroupDetails.id/providers/Microsoft.Storage/storageAccounts/$storageAccountName?api-version=2016-01-01"

        $headers = @{"x-ms-client-request-id"="a21c4b0a-2226-4ab5-a473-e39459e6369a"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $storageAccountUnformatted = $null
        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $storageAccountUnformatted=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
        }
        else
        {
            $storageAccountUnformatted=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
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
        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint
        $accessToken = Get-SpnAccessToken $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId

        $method="GET"
        $uri = "$script:azureRmUri/subscriptions/$subscriptionId/resourceGroups?api-version=2016-02-01"

        $headers = @{"x-ms-client-request-id"="f18eb0d7-20c2-44b9-af30-21dab6afbcde"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if (("$proxyUri" -eq $null) or ("$proxyUri" -eq $uri))
        {
            $resourceGroups=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            return $resourceGroups
        }
        else
        {
            $resourceGroups=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            return $resourceGroups
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