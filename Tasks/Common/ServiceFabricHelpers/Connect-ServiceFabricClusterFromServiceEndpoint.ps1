# Function that can be mocked by tests
function Create-Object
{
    Param (
        [String]
        $TypeName,

        [Object[]]
        $ArgumentList
    )

    return New-Object -TypeName $TypeName -ArgumentList $ArgumentList
}

function Get-AadSecurityToken
{
    Param (
        [Hashtable]
        $ClusterConnectionParameters,

        $ConnectedServiceEndpoint
    )

    # Configure connection parameters to get cluster metadata
    $connectionParametersWithGetMetadata = $ClusterConnectionParameters.Clone()
    $connectionParametersWithGetMetadata.Add("GetMetadata", $true)

    # Query cluster metadata
    $global:operationId = $SF_Operations.ConnectClusterMetadata
    $connectResult = Connect-ServiceFabricClusterAction -ClusterConnectionParameters $connectionParametersWithGetMetadata
    $authority = $connectResult.AzureActiveDirectoryMetadata.Authority
    Write-Host (Get-VstsLocString -Key AadAuthority -ArgumentList $authority)
    $clusterApplicationId = $connectResult.AzureActiveDirectoryMetadata.ClusterApplication
    Write-Host (Get-VstsLocString -Key ClusterAppId -ArgumentList $clusterApplicationId)
    $clientApplicationId = $connectResult.AzureActiveDirectoryMetadata.ClientApplication
    Write-Host (Get-VstsLocString -Key ClientAppId -ArgumentList $clientApplicationId)

    # MSAL flag
    $useMSAL = $false
    $rawOverrideUseMSAL = Get-VstsTaskVariable -Name 'USE_MSAL'
    try 
    {
        if($rawOverrideUseMSAL) {
            Write-Verbose "MSAL - USE_MSAL override is found: $rawOverrideUseMSAL"
            $useMSAL = [bool]::Parse($rawOverrideUseMSAL)
        }
    } 
    catch 
    {
        # this is not a blocker error, so we're informing
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "MSAL - USE_MSAL couldn't be parsed due to error $exceptionMessage. useMSAL=$useMSAL is used instead"
    }
    
    # Acquire AAD access token - MSAL
    if ($useMSAL) 
    {
        $accessToken = @{
            token_type = $null
            access_token = $null
            expires_on = $null
        }

        $tenantId = $connectResult.AzureActiveDirectoryMetadata.TenantId

        # load the MSAL library
        Add-Type -Path "$PSScriptRoot\msal\Microsoft.Identity.Client.dll"

        $authParams = $ConnectedServiceEndpoint.Auth.Parameters
        
        $msalClientInstance = [Microsoft.Identity.Client.PublicClientApplicationBuilder]::Create($clientApplicationId).WithAuthority($authority, $tenantId).Build()
        
        # scopes
        $azureActiveDirectoryResourceId = $clusterApplicationId + "/.default"
        $scopes = [Collections.Generic.List[string]]@($azureActiveDirectoryResourceId)

        # fetch
        try {
            Write-Verbose "Fetching Access Token - MSAL"
            $tokenResult = $msalClientInstance.AcquireTokenByUsernamePassword($scopes, $authParams.Username, $authParams.Password).ExecuteAsync().GetAwaiter().GetResult()
        }
        catch {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AadSecurityToken) (MSAL)"
            throw (Get-VstsLocString -Key ErrorOnAcquireToken -ArgumentList $_)
        }

        $accessToken.token_type = $tokenResult.TokenType
        $accessToken.access_token = $tokenResult.AccessToken
        $accessToken.expires_on = $tokenResult.ExpiresOn.ToUnixTimeSeconds()

        return $accessToken.access_token
    }
    # Acquire AAD access token - ADAL
    else 
    {
        Add-Type -LiteralPath "$PSScriptRoot\Microsoft.IdentityModel.Clients.ActiveDirectory.dll"
        $authContext = Create-Object -TypeName Microsoft.IdentityModel.Clients.ActiveDirectory.AuthenticationContext -ArgumentList @($authority)
        $authParams = $ConnectedServiceEndpoint.Auth.Parameters
        $userCredential = Create-Object -TypeName Microsoft.IdentityModel.Clients.ActiveDirectory.UserCredential -ArgumentList @($authParams.Username, $authParams.Password)

        try
        {
            # Acquiring a token using UserCredential implies a non-interactive flow. No credential prompts will occur.
            $accessToken = $authContext.AcquireToken($clusterApplicationId, $clientApplicationId, $userCredential).AccessToken
        }
        catch
        {
            throw (Get-VstsLocString -Key ErrorOnAcquireToken -ArgumentList $_)
        }

        return $accessToken
    }
}

function Add-Certificate
{
    Param (
        [Hashtable]
        $ClusterConnectionParameters,

        $ConnectedServiceEndpoint
    )

    $storeName = [System.Security.Cryptography.X509Certificates.StoreName]::My;
    $storeLocation = [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser

    # Generate a certificate from the service endpoint values
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2

    try
    {
        $bytes = [System.Convert]::FromBase64String($ConnectedServiceEndpoint.Auth.Parameters.Certificate)

        if ($ConnectedServiceEndpoint.Auth.Parameters.CertificatePassword)
        {
            $certPassword = $ConnectedServiceEndpoint.Auth.Parameters.CertificatePassword
        }

        # Explicitly set the key storage to use UserKeySet.  This will ensure the private key is stored in a folder location which the user has access to.
        # If we don't explicitly set it to UserKeySet, it's possible the MachineKeySet will be used which the user doesn't have access to that folder location, resulting in an access denied error.
        $certificate.Import($bytes, $certPassword, "PersistKeySet,UserKeySet")
    }
    catch
    {
        throw (Get-VstsLocString -Key ErrorOnCertificateImport -ArgumentList $_)
    }

    # Add the certificate to the cert store.
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, $storeLocation)
    $store.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))
    try
    {
        $store.Add($certificate)
    }
    finally
    {
        $store.Close()
        $store.Dispose()
    }

    Write-Host (Get-VstsLocString -Key ImportedCertificate -ArgumentList $certificate.Thumbprint)

    # Override the certificate-related cluster connection parameters to known and supported values
    $clusterConnectionParameters["FindType"] = "FindByThumbprint"
    $clusterConnectionParameters["FindValue"] = $certificate.Thumbprint
    $clusterConnectionParameters["StoreName"] = $storeName.ToString()
    $clusterConnectionParameters["StoreLocation"] = $storeLocation.ToString()

    return $certificate
}
function Remove-ClientCertificate
{
    [CmdletBinding()]
    Param (
        $Certificate
    )

    try
    {
        if ($null -ne $Certificate)
        {
            $thumbprint = $Certificate.Thumbprint
            if (Test-Path "Cert:\CurrentUser\My\$thumbprint")
            {
                Remove-Item "Cert:\CurrentUser\My\$thumbprint" -Force
            }
        }
    }
    catch
    {
        Write-Warning (Get-VstsLocString -Key WarningOnRemoveCertificate -ArgumentList $_)
    }
}
function Trace-WarningIfCertificateNotPresentInLocalCertStore{
    [CmdletBinding()]
    Param (
        $certificate
    )

    if ($null -ne $certificate)
    {
        $thumbprint = $certificate.Thumbprint
        if (!(Test-Path "Cert:\CurrentUser\My\$thumbprint"))
        {
            Write-Warning (Get-VstsLocString -Key CertNotPresentInLocalStoreWarningMsg -ArgumentList $thumbprint)
        }
    }
}
function Connect-ServiceFabricClusterFromServiceEndpoint
{
    [CmdletBinding()]
    param(
        [Hashtable]
        $ClusterConnectionParameters,

        $ConnectedServiceEndpoint
    )

    Trace-VstsEnteringInvocation $MyInvocation

    Import-Module $PSScriptRoot/../TlsHelper_
    Import-Module $PSScriptRoot/../PowershellHelpers
    Add-Tls12InSession

    try
    {
        if (![Environment]::Is64BitProcess)
        {
            throw (Get-VstsLocString -Key TaskNotRunningOnx64Agent)
        }

        $certificate = $null
        $regKey = "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"
        if (!(Test-Path $regKey))
        {
            throw (Get-VstsLocString -Key ServiceFabricSDKNotInstalled)
        }

        $connectionEndpointUrl = [System.Uri]$ConnectedServiceEndpoint.Url
        # Override the publish profile's connection endpoint with the one defined on the associated service endpoint
        $clusterConnectionParameters["ConnectionEndpoint"] = $connectionEndpointUrl.Authority # Authority includes just the hostname and port

        # Configure cluster connection pre-reqs
        if ($ConnectedServiceEndpoint.Auth.Scheme -ne "None")
        {
            # Add server cert thumbprint(s)/commonname(s) (common to both auth-types)
            if ($ConnectedServiceEndpoint.Auth.Parameters.ServerCertCommonName) 
            {
                $clusterConnectionParameters["ServerCommonName"] = $ConnectedServiceEndpoint.Auth.Parameters.ServerCertCommonName -split ',' | ForEach-Object { $_.Trim() }
            } 
            elseif ($ConnectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint) 
            {
                $clusterConnectionParameters["ServerCertThumbprint"] = $ConnectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint -split ',' | ForEach-Object { $_.Trim() }
            }

            # Add auth-specific parameters
            if ($ConnectedServiceEndpoint.Auth.Scheme -eq "UserNamePassword")
            {
                # Setup the AzureActiveDirectory and ServerCertThumbprint parameters before getting the security token, because getting the security token
                # requires a connection request to the cluster in order to get metadata and so these two parameters are needed for that request.
                $clusterConnectionParameters["AzureActiveDirectory"] = $true

                $securityToken = Get-AadSecurityToken -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $ConnectedServiceEndpoint
                $clusterConnectionParameters["SecurityToken"] = $securityToken
                $clusterConnectionParameters["WarningAction"] = "SilentlyContinue"
            }
            elseif ($ConnectedServiceEndpoint.Auth.Scheme -eq "Certificate")
            {
                $certificate = Add-Certificate -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $ConnectedServiceEndpoint
                $clusterConnectionParameters["X509Credential"] = $true
            }
        }
        else
        {
            if ($ConnectedServiceEndpoint.Auth.Parameters.Unsecured  -ne "true")
            {
                Write-Debug (Get-VstsLocString -Key Unsecured)
                $clusterConnectionParameters["WindowsCredential"] = $true

                $clusterSpn = $ConnectedServiceEndpoint.Auth.Parameters.ClusterSpn
                if ($clusterSpn)
                {
                    $clusterConnectionParameters["ClusterSpn"] = $clusterSpn
                }
            }
        }

        # Connect to cluster
        $global:operationId = $SF_Operations.ConnectCluster
        try
        {
            [void](Connect-ServiceFabricClusterAction -ClusterConnectionParameters $clusterConnectionParameters)
            return $certificate
        }
        catch
        {
            if ($connectionEndpointUrl.Port -ne "19000")
            {
                Write-Warning (Get-VstsLocString -Key DefaultPortWarning $connectionEndpointUrl.Port)
            }

            throw $_
        }

    }
    catch
    {
        Assert-TlsError -exception $_.Exception
        throw
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Connect-ServiceFabricClusterAction
{
    param(
        [Hashtable]
        $ClusterConnectionParameters
    )

    $connectResult = $null

    try
    {
        # Call a trial Connect-ServiceFabricCluster first so that ServiceFabric PS module gets loaded. Retry only if this connect fails.
        $connectResult = Connect-ServiceFabricCluster @clusterConnectionParameters
    }
    catch [System.Fabric.FabricTransientException], [System.TimeoutException]
    {
        $connectAction = { Connect-ServiceFabricCluster @clusterConnectionParameters }
        $connectResult = Invoke-ActionWithRetries -Action $connectAction `
            -MaxTries 3 `
            -RetryIntervalInSeconds 10 `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException") `
            -RetryMessage (Get-VstsLocString -Key RetryingClusterConnection)
    }

    Write-Host (Get-VstsLocString -Key ConnectedToCluster)

    # Reset the scope of the ClusterConnection variable that gets set by the call to Connect-ServiceFabricCluster so that it is available outside the scope of this module
    Set-Variable -Name ClusterConnection -Value $Private:ClusterConnection -Scope Global
    return $connectResult
}