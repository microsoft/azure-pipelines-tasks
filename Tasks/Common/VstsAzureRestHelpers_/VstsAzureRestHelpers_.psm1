# Private module-scope variables.
$script:azureUri = "https://management.core.windows.net/"
$script:azureRmUri = "https://management.azure.com/"
$script:authUri = "https://login.microsoftonline.com/"
$script:jsonContentType = "application/json;charset=utf-8"
$script:formContentType = "application/x-www-form-urlencoded;charset=utf-8"

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

    $authUri = "$script:authUri/common/oauth2/token"
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

    # Prepare contents for POST

    $authUri = "$script:authUri/$tenantId/oauth2/token"
    $body = @{
        resource=$script:azureUri
        client_id=$principalId
        grant_type='client_credentials'
        client_secret=$principalKey
    }
    
    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token"

    try
    {
        $accessToken = (Invoke-RestMethod -Uri $authUri -Method POST -Body $body -ContentType $script:formContentType)
        return $accessToken
    }
    catch
    {
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

# Get the Azure Resource Id
function Get-AzureSqlDatabaseServerResourceId
{
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [Object] [Parameter(Mandatory = $true)] $endpoint,
          [Object] [Parameter(Mandatory = $true)] $accessToken)

    $serverType = "Microsoft.Sql/servers"
    $subscriptionId = $endpoint.Data.SubscriptionId

    Write-Verbose "[Azure Rest Call] Get Resource Groups"
    $method = "GET"
    $uri = "$script:azureRmUri/subscriptions/$subscriptionId/resources?api-version=$apiVersion"
    $headers = @{Authorization=("{0} {1}" -f $accessToken.token_type, $accessToken.access_token)}

    $ResourceDetails = (Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType)
    foreach ($resourceDetail in $ResourceDetails.Value)
    {
        if ($resourceDetail.name -eq $serverName -and $resourceDetail.type -eq $serverType)
        {
            return $resourceDetail.id
        }
    }

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

    $subscriptionId = $endpoint.Data.SubscriptionId
    $uri = "$script:azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules"
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

    $uri = "$script:azureRmUri/$azureResourceId/firewallRules/$firewallRuleName\?api-version=$apiVersion"
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

    $subscriptionId = $endpoint.Data.SubscriptionId
    $uri = "$script:azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules/$firewallRuleName"

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

    $uri = "$script:azureRmUri/$azureResourceId/firewallRules/$firewallRuleName\?api-version=$apiVersion"
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

function Remove-AzureSqlDatabaseServerFirewallRule
{
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Trace-VstsEnteringInvocation $MyInvocation
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

# Export only the public function.
Export-ModuleMember -Function Add-AzureSqlDatabaseServerFirewallRule
Export-ModuleMember -Function Remove-AzureSqlDatabaseServerFirewallRule