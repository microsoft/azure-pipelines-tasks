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
    $connectResult = Connect-ServiceFabricCluster @connectionParametersWithGetMetadata
    $authority = $connectResult.AzureActiveDirectoryMetadata.Authority
    Write-Host (Get-VstsLocString -Key AadAuthority -ArgumentList $authority)
    $clusterApplicationId = $connectResult.AzureActiveDirectoryMetadata.ClusterApplication
    Write-Host (Get-VstsLocString -Key ClusterAppId -ArgumentList $clusterApplicationId)
    $clientApplicationId = $connectResult.AzureActiveDirectoryMetadata.ClientApplication
    Write-Host (Get-VstsLocString -Key ClientAppId -ArgumentList $clientApplicationId)

    # Acquire AAD access token
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
        $certificate.Import($bytes, $certPassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::UserKeySet)
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

function Connect-ServiceFabricClusterFromServiceEndpoint {
    [CmdletBinding()]
    param(
        [Hashtable]
        $ClusterConnectionParameters,

        $ConnectedServiceEndpoint
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {

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
            # Add server cert thumbprint (common to both auth-types)
            if ($ConnectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint)
            {
                $clusterConnectionParameters["ServerCertThumbprint"] = $ConnectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint
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
                Add-Certificate -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $ConnectedServiceEndpoint
                $clusterConnectionParameters["X509Credential"] = $true
            }
        }
        else
        {
            if ($ConnectedServiceEndpoint.Auth.Parameters.IsWindowsCredential -eq "true")
            {
                Write-Debug (Get-VstsLocString -Key UseWindowsCredential)
                $clusterConnectionParameters["WindowsCredential"] = $true
            }
        }

        # Connect to cluster
        try {
            [void](Connect-ServiceFabricCluster @clusterConnectionParameters)
        }
        catch {
            if ($connectionEndpointUrl.Port -ne "19000") {
                Write-Warning (Get-VstsLocString -Key DefaultPortWarning $connectionEndpointUrl.Port)
            }

            throw $_
        }

        Write-Host (Get-VstsLocString -Key ConnectedToCluster)

        # Reset the scope of the ClusterConnection variable that gets set by the call to Connect-ServiceFabricCluster so that it is available outside the scope of this module
        Set-Variable -Name ClusterConnection -Value $Private:ClusterConnection -Scope Global

    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}