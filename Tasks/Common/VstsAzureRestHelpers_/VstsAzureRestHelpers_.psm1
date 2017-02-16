# Private module-scope variables.
$script:jsonContentType = "application/json;charset=utf-8"
$script:formContentType = "application/x-www-form-urlencoded;charset=utf-8"
$script:defaultAuthUri = "https://login.microsoftonline.com/"
$script:defaultEnvironmentAuthUri = "https://login.windows.net/"

# Connection Types
$certificateConnection = 'Certificate'
$usernameConnection = 'UserNamePassword'
$spnConnection = 'ServicePrincipal'

# Well-Known ClientId
$azurePsClientId = "1950a258-227b-4e31-a9cf-717495945fc2"

# API-Version(s)
$apiVersion = "2014-04-01"

# Override the DebugPreference.
if ($global:DebugPreference -eq 'Continue') {
    Write-Verbose '$OVERRIDING $global:DebugPreference from ''Continue'' to ''SilentlyContinue''.'
    $global:DebugPreference = 'SilentlyContinue'
}

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

function Get-AzureUri
{
    param([object] [Parameter(Mandatory=$true)] $endpoint)

    $url = $endpoint.url
    if ($url -ne $null -and $url[-1] -eq '/')
    {
        return $url.Substring(0,$url.Length-1)
    }
    return $url
}

function Get-ProxyUri
{
    param([String] [Parameter(Mandatory=$true)] $serverUrl)
    
    $proxyUri = [System.Uri]($env:AGENT_PROXYURL)
    Write-Verbose -Verbose ("Reading proxy from the AGENT_PROXYURL environment variable. Proxy url specified={0}" -f $proxyUri.OriginalString)

    if($proxyUri -eq $null)
    {
        $proxy = [System.Net.WebRequest]::GetSystemWebProxy()
        $proxyUri = $proxy.GetProxy("$serverUrl")
        Write-Verbose -Verbose ("Reading proxy from IE. Proxy url specified={0}" -f $proxyUri.OriginalString)
    }

    if($serverUrl -eq $null -or ([System.Uri]$serverUrl).Host -eq $proxyUri.Host)
    {
        return $null
    }

    return $proxyUri
}

# Check if Azure connection type is classic or not.
function IsLegacyAzureConnection
{
    param([Parameter(Mandatory=$true)] $connectionType)

    Write-Verbose "Connection type used is $connectionType"
    if($connectionType -eq $certificateConnection -or $connectionType -eq $usernameConnection)
    {
        return $true
    }
    else
    {
        return $false
    }
}

# Check if Azure connection is RM type or not.
function IsAzureRmConnection
{
    param([Parameter(Mandatory=$true)] $connectionType)

    Write-Verbose "Connection type used is $connectionType"
    if($connectionType -eq $spnConnection)
    {
        return $true
    }
    else
    {
        return $false
    }
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
    param([Parameter(Mandatory=$true)] $endpoint)

    # Well known Client-Id
    $password = $endpoint.Auth.Parameters.Password
    $username = $endpoint.Auth.Parameters.UserName
    $authUrl = $script:defaultAuthUri
    if($endpoint.Data.activeDirectoryAuthority)
    {
        $authUrl = $endpoint.Data.activeDirectoryAuthority
    }

    $authUri = "$authUrl/common/oauth2/token"
    $body = @{
        resource=$script:azureUri
        client_id=$azurePsClientId
        grant_type='password'
        username=$username
        password=$password
    }

    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token"

    try {
        $accessToken = Invoke-RestMethod -Uri $authUri -Method POST -Body $body -ContentType $script:formContentType
        return $accessToken
    }
    catch
    {
        throw (Get-VstsLocString -Key AZ_UserAccessTokenFetchFailure)
    }
}

# Get the Bearer Access Token from the Endpoint
function Get-SpnAccessToken {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)] $endpoint)

    $principalId = $endpoint.Auth.Parameters.ServicePrincipalId
    $tenantId = $endpoint.Auth.Parameters.TenantId
    $principalKey = $endpoint.Auth.Parameters.ServicePrincipalKey
    $envAuthUrl = $script:defaultEnvironmentAuthUri
    if($endpoint.Data.environmentAuthorityUrl)
    {
        $envAuthUrl = $endpoint.Data.environmentAuthorityUrl
    }

    $azureUri = Get-AzureUri $endpoint

    # Prepare contents for POST
    $method = "POST"
    $authUri = "$envAuthUrl" + "$tenantId/oauth2/token"
    $body = @{
        resource=$azureUri+"/"
        client_id=$principalId
        grant_type='client_credentials'
        client_secret=$principalKey
    }
    
    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token"
    
    try
    {
        $proxyUri = Get-ProxyUri $authUri
        if ($proxyUri -eq $null)
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
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "ExceptionMessage: $exceptionMessage (in function: Get-SpnAccessToken)"
        throw (Get-VstsLocString -Key AZ_SpnAccessTokenFetchFailure -ArgumentList $tenantId)
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
        $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
        $azureUri = Get-AzureUri $endpoint

        $uri="$azureUri/$subscriptionId/services/storageservices/$storageAccountName/keys"
        $headers = @{"x-ms-version"="2016-03-01"}
        $method="GET"

        $certificate = Get-Certificate $endpoint

        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
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
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzStorageKeys)"
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
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Storage/storageAccounts/$storageAccountName/listKeys" + '?api-version=2015-06-15'

        $headers = @{"Authorization" = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
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
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRMStorageKeys)"
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
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name" + '?api-version=2016-03-30'

        $headers = @{"accept-language" = "en-US"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
        {
            $customScriptExt=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No proxy settings"
            return $customScriptExt.properties
        }
        else
        {
            $customScriptExt=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using proxy settings"
            return $customScriptExt.properties
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRmVmCustomScriptExtension)"
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
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name" + '?api-version=2016-03-30'

        $headers = @{"accept-language" = "en-US"}
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
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
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Remove-AzRmVmCustomScriptExtension)"
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
        $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
        $azureUri = Get-AzureUri $endpoint

        $uri="$azureUri/$subscriptionId/services/storageservices/$storageAccountName"
        $headers = @{"x-ms-version"="2016-03-01"}
        $method="GET"

        $certificate = Get-Certificate $endpoint

        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
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
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzStorageAccount)"
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
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Storage/storageAccounts/$storageAccountName" + '?api-version=2016-01-01'

        $headers = @{"Authorization" = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

        $storageAccountUnformatted = $null
        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
        {
            $storageAccountUnformatted=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No Proxy settings"
        }
        else
        {
            $storageAccountUnformatted=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
        }

        Write-Verbose "Constructing the storage account object"
        
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
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRmStorageAccount)"
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
        $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

        $method="GET"
        $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName" + '?api-version=2016-02-01'

        $headers = @{"Authorization" = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

        $proxyUri = Get-ProxyUri $uri
        if ($proxyUri -eq $null)
        {
            $resourceGroup=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            Write-Verbose "No Proxy settings"
            return $resourceGroup
        }
        else
        {
            $resourceGroup=Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials
            Write-Verbose "Using Proxy settings"
            return $resourceGroup
        }
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRmResourceGroup)"
        throw
    }
}

# Get the Azure Resource Id
function Get-AzureSqlDatabaseServerResourceId
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [Object] [Parameter(Mandatory = $true)] $endpoint,
          [Object] [Parameter(Mandatory = $true)] $accessToken)

    $serverType = "Microsoft.Sql/servers"
    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

    Write-Verbose "[Azure Rest Call] Get Resource Groups"
    $method = "GET"
    $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resources?api-version=$apiVersion"
    $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

    do {
        Write-Verbose "Fetching Resources from $uri"
        $ResourceDetails = (Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType)
        foreach ($resourceDetail in $ResourceDetails.Value)
        {
            if ($resourceDetail.name -eq $serverName -and $resourceDetail.type -eq $serverType)
            {
                return $resourceDetail.id
            }
        }
        $uri = $ResourceDetails.nextLink
    } until([string]::IsNullOrEmpty($ResourceDetails.nextLink))

    throw (Get-VstsLocString -Key AZ_NoValidResourceIdFound -ArgumentList $serverName, $serverType, $subscriptionId)
}

function Add-LegacyAzureSqlServerFirewall
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $startIPAddress,
          [String] [Parameter(Mandatory = $true)] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
    $azureUri = Get-AzureUri $endpoint

    $uri = "$azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules"
    $method = "POST"

    $body = @{
        Name=$firewallRuleName
        StartIPAddress=$startIPAddress
        EndIPAddress=$endIPAddress
        }

    $body = $body | ConvertTo-JSON
    $headers = @{"x-ms-version"=$apiVersion}

    # Get Certificate or bearer token and call Rest API
    if($endpoint.Auth.Scheme -eq $certificateConnection)
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

function Add-AzureRmSqlServerFirewall
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $startIPAddress,
          [String] [Parameter(Mandatory = $true)] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $accessToken = Get-SpnAccessToken $endpoint
    # get azure sql server resource Id
    $azureResourceId = Get-AzureSqlDatabaseServerResourceId -endpoint $endpoint -serverName $serverName -accessToken $accessToken

    $uri = "$($endpoint.Url)/$azureResourceId/firewallRules/$firewallRuleName\?api-version=$apiVersion"
    $body = "{
            'properties' : {
            'startIpAddress':'$startIPAddress',
            'endIpAddress':'$endIPAddress'
            }
        }"

    $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

    Invoke-RestMethod -Uri $uri -Method PUT -Headers $headers -Body $body -ContentType $script:jsonContentType
}

function Remove-LegacyAzureSqlServerFirewall
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
    $azureUri = Get-AzureUri $endpoint
    $uri = "$azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules/$firewallRuleName"

    $headers = @{"x-ms-version"=$apiVersion}

    # Get Certificate or PS Credential & Call Invoke
    if($endpoint.Auth.Scheme -eq $certificateConnection)
    {
        $certificate = Get-Certificate $endpoint
        Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers -Certificate $certificate
    }
    else
    {
        $accessToken = Get-UsernamePasswordAccessToken $endpoint
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers
    }
}

function Remove-AzureRmSqlServerFirewall
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $accessToken = Get-SpnAccessToken $endpoint

    # Fetch Azure SQL server resource Id
    $azureResourceId = Get-AzureSqlDatabaseServerResourceId -endpoint $endpoint -serverName $serverName -accessToken $accessToken

    $uri = "$($endpoint.Url)/$azureResourceId/firewallRules/$firewallRuleName\?api-version=$apiVersion"
    $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

    Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers

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
        Write-Verbose "Creating firewall rule $firewallRuleName"

        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint

        if(IsLegacyAzureConnection $connectionType)
        {
            Add-LegacyAzureSqlServerFirewall -endpoint $endpoint -serverName $serverName -startIPAddress $startIPAddress -endIPAddress $endIPAddress -firewallRuleName $firewallRuleName
        }
        elseif (IsAzureRmConnection $connectionType)
        {

            Add-AzureRmSqlServerFirewall -endpoint $endpoint -serverName $serverName -startIPAddress $startIPAddress -endIPAddress $endIPAddress -firewallRuleName $firewallRuleName
        }
        else
        {
            throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $connectionType)
        }

        Write-Verbose "Firewall rule $firewallRuleName created"
    }
    catch 
    {
        $parsedException = Parse-Exception($_.Exception)
        if($parsedException)
        {
            throw  $parsedException
        }
        throw $_.Exception.ToString()
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
        Write-Verbose "Removing firewall rule $firewallRuleName on azure database server: $serverName"

        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint

        if(IsLegacyAzureConnection $connectionType)
        {
            Remove-LegacyAzureSqlServerFirewall -endpoint $endpoint -serverName $serverName -firewallRuleName $firewallRuleName
        }
        elseif (IsAzureRmConnection $connectionType)
        {
            Remove-AzureRmSqlServerFirewall -endpoint $endpoint -serverName $serverName -firewallRuleName $firewallRuleName
        }
        else
        {
            throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $connectionType)
        }

        Write-Verbose "Removed firewall rule $firewallRuleName on azure database server: $serverName"
    }
    catch 
    {
        $parsedException = Parse-Exception($_.Exception)
        if($parsedException)
        {
            throw  $parsedException
        }
        throw $_.Exception.ToString()
    }
}

function Parse-Exception($exception){
    if($exception) {
        Write-Verbose "Exception message - $($exception.ToString())"
        $response = $exception.Response
        if($response) {
            $responseStream =  $response.GetResponseStream()
            $streamReader = New-Object System.IO.StreamReader($responseStream)
            $streamReader.BaseStream.Position = 0
            $streamReader.DiscardBufferedData()
            $responseBody = $streamReader.ReadToEnd()
            $streamReader.Close()
            Write-Verbose "Exception message extracted from response $responseBody"
            $exceptionMessage = "";
            try
            {
                if($responseBody)
                {
                    $exceptionJson = $responseBody | ConvertFrom-Json
                    $exceptionMessage = $exceptionJson.Message
                }
            }
            catch{
                $exceptionMessage = $responseBody
            }
            if($response.statusCode -eq 404 -or (-not $exceptionMessage)){
                $exceptionMessage += " Please verify request URL : $($response.ResponseUri)" 
            }
            return $exceptionMessage
        }
    }
    return $null
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
