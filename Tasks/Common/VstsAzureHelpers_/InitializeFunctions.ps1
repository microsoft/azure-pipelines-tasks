function Add-Certificate {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)]$Endpoint)

    # Add the certificate to the cert store.
    $bytes = [System.Convert]::FromBase64String($Endpoint.Auth.Parameters.Certificate)
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $certificate.Import($bytes)
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        ([System.Security.Cryptography.X509Certificates.StoreName]::My),
        ([System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser))
    $store.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))
    $store.Add($certificate)
    $store.Close()
    return $certificate
}

function Format-Splat {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Hashtable)

    # Collect the parameters (names and values) in an array.
    $parameters = foreach ($key in $Hashtable.Keys) {
        $value = $Hashtable[$key]
        # If the value is a bool, format the parameter as a switch (ending with ':').
        if ($value -is [bool]) { "-$($key):" } else { "-$key" }
        $value
    }

    $OFS = " "
    "$parameters" # String join the array.
}

function Initialize-AzureSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string]$StorageAccount)

    #Set UserAgent for Azure Calls
    Set-UserAgent

    $environmentName = "AzureCloud"
    if($Endpoint.Data.Environment) {
        $environmentName = $Endpoint.Data.Environment
        if($environmentName -eq "AzureStack")
        {
            Add-AzureStackAzureRmEnvironment -endpoint $Endpoint -name "AzureStack"
        }
    }

    if ($Endpoint.Auth.Scheme -eq 'Certificate') {
        # Certificate is only supported for the Azure module.
        if (!$script:azureModule) {
            throw (Get-VstsLocString -Key AZ_CertificateAuthNotSupported)
        }

        # Add the certificate to the cert store.
        $certificate = Add-Certificate -Endpoint $Endpoint

        # Setup the additional parameters.
        $additional = @{ }
        if ($StorageAccount) {
            $additional['CurrentStorageAccountName'] = $StorageAccount
        }

        # Set the subscription.
        Write-Host "##[command]Set-AzureSubscription -SubscriptionName $($Endpoint.Data.SubscriptionName) -SubscriptionId $($Endpoint.Data.SubscriptionId) -Certificate ******** -Environment $environmentName $(Format-Splat $additional)"
        Set-AzureSubscription -SubscriptionName $Endpoint.Data.SubscriptionName -SubscriptionId $Endpoint.Data.SubscriptionId -Certificate $certificate -Environment $environmentName @additional
        Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
    } elseif ($Endpoint.Auth.Scheme -eq 'UserNamePassword') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.UserName,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.Password -AsPlainText -Force))

        # Add account (Azure).
        if ($script:azureModule) {
            try {
                Write-Host "##[command]Add-AzureAccount -Credential $psCredential"
                $null = Add-AzureAccount -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_CredentialsError), $_.Exception))
            }
        }

        # Add account (AzureRM).
        if ($script:azureRMProfileModule) {
            try {
                Write-Host "##[command]Add-AzureRMAccount -Credential $psCredential"
                $null = Add-AzureRMAccount -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_CredentialsError), $_.Exception))
            }
        }

        # Select subscription (Azure).
        if ($script:azureModule) {
            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        }

        # Select subscription (AzureRM).
        if ($script:azureRMProfileModule) {
            Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId
        }
    } elseif ($Endpoint.Auth.Scheme -eq 'ServicePrincipal') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.ServicePrincipalId,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))
        if ($script:azureModule -and $script:azureModule.Version -lt ([version]'0.9.9')) {
            # Service principals arent supported from 0.9.9 and greater in the Azure module.
            try {
                Write-Host "##[command]Add-AzureAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential"
                $null = Add-AzureAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
            }

            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        } elseif ($script:azureModule) {
            # Throw if >=0.9.9 Azure.
            throw (Get-VstsLocString -Key "AZ_ServicePrincipalAuthNotSupportedAzureVersion0" -ArgumentList $script:azureModule.Version)
        } else {
            # Else, this is AzureRM.
            try {
                if(CmdletHasMember -cmdlet "Add-AzureRMAccount" -memberName "EnvironmentName")
                {
                    Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -EnvironmentName $environmentName"
                    $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -EnvironmentName $environmentName
                }
                else
                {
                    Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -Environment $environmentName"
                    $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -Environment $environmentName
                }
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
            }

            Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }
    } else {
        throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
    }
}

function Set-CurrentAzureSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$StorageAccount)

    $additional = @{ }
    if ($script:azureModule.Version -lt ([version]'0.8.15')) {
        $additional['Default'] = $true # The Default switch is required prior to 0.8.15.
    }

    Write-Host "##[command]Select-AzureSubscription -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Select-AzureSubscription -SubscriptionId $SubscriptionId @additional
    if ($StorageAccount) {
        Write-Host "##[command]Set-AzureSubscription -SubscriptionId $SubscriptionId -CurrentStorageAccountName $StorageAccount"
        Set-AzureSubscription -SubscriptionId $SubscriptionId -CurrentStorageAccountName $StorageAccount
    }
}

function Set-CurrentAzureRMSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$TenantId)

    $additional = @{ }
    if ($TenantId) { $additional['TenantId'] = $TenantId }
    Write-Host "##[command]Select-AzureRMSubscription -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Select-AzureRMSubscription -SubscriptionId $SubscriptionId @additional
}

function Set-UserAgent {
    [CmdletBinding()]
    param()

	$userAgent = Get-VstsTaskVariable -Name AZURE_HTTP_USER_AGENT
    if ($userAgent) {
        Set-UserAgent_Core -UserAgent $userAgent
    }
}

function Set-UserAgent_Core {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$UserAgent)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        [Microsoft.Azure.Common.Authentication.AzureSession]::ClientFactory.AddUserAgent($UserAgent)
    } catch {
        Write-Verbose "Set-UserAgent failed with exception message: $_.Exception.Message"
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function CmdletHasMember {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$cmdlet,
        [Parameter(Mandatory=$true)]
        [string]$memberName)
    try{
        $hasMember = (gcm $cmdlet).Parameters.Keys.Contains($memberName)
        return $hasMember
    }
    catch
    {
        return false;
    }
}

<#
    Adds Azure Stack environment to use with AzureRM command-lets when targeting Azure Stack
#>
function Add-AzureStackAzureRmEnvironment {
    param (
        [Parameter(mandatory=$true, HelpMessage="The Admin ARM endpoint of the Azure Stack Environment")]
        $Endpoint,
        [parameter(mandatory=$true, HelpMessage="Azure Stack environment name for use with AzureRM commandlets")]
        [string] $Name
    )

    $EndpointURI = $Endpoint.Url.TrimEnd("/")

    $Domain = ""
    try {
        $uriendpoint = [System.Uri] $EndpointURI
        $i = $EndpointURI.IndexOf('.')
        $Domain = ($EndpointURI.Remove(0,$i+1)).TrimEnd('/')
    }
    catch {
        Write-Error (Get-VstsLocString -Key AZ_InvalidARMEndpoint)
    }

    $ResourceManagerEndpoint = $EndpointURI
    $stackdomain = $Domain

    $AzureKeyVaultDnsSuffix="vault.$($stackdomain)".ToLowerInvariant()
    $AzureKeyVaultServiceEndpointResourceId= $("https://vault.$stackdomain".ToLowerInvariant())
    $StorageEndpointSuffix = ($stackdomain).ToLowerInvariant()

    # Check if endpoint data contains required data.
    if($Endpoint.data.GraphUrl -eq $null)
    { 
        $azureStackEndpointUri = $EndpointURI.ToString() + "/metadata/endpoints?api-version=2015-01-01"
        $proxyUri = Get-ProxyUri $azureStackEndpointUri

        Write-Verbose "Retrieving endpoints from the $ResourceManagerEndpoint"
        if ($proxyUri -eq $null)
        {
            Write-Verbose "No proxy settings"
            $endpointData = Invoke-RestMethod -Uri $azureStackEndpointUri -Method Get -ErrorAction Stop
        }
        else
        {
            Write-Verbose "Using Proxy settings"
            $endpointData = Invoke-RestMethod -Uri $azureStackEndpointUri -Method Get -Proxy $proxyUri -ErrorAction Stop 
        }

        if ($endpointData)
        {
            $authenticationData = $endpointData.authentication;
            if ($authenticationData)
            {
                $loginEndpoint = $authenticationData.loginEndpoint
                if($loginEndpoint)
                {
                    $aadAuthorityEndpoint = $loginEndpoint
                    $activeDirectoryEndpoint = $loginEndpoint.TrimEnd('/') + "/"
                }

                $audiences = $authenticationData.audiences
                if($audiences.Count -gt 0)
                {
                    $activeDirectoryServiceEndpointResourceId = $audiences[0]
                }
            }

            $graphEndpoint = $endpointData.graphEndpoint
            $graphAudience = $endpointData.graphEndpoint
            $galleryEndpoint = $endpointData.galleryEndpoint
        }
    }
    else
    {
        $aadAuthorityEndpoint = $Endpoint.data.ActiveDirectoryAuthority.Trim("/") + "/"
        $graphEndpoint = $Endpoint.data.graphUrl
        $graphAudience = $Endpoint.data.graphUrl
        $activeDirectoryEndpoint = $Endpoint.data.ActiveDirectoryAuthority.Trim("/") + "/"
        $activeDirectoryServiceEndpointResourceId = $Endpoint.data.activeDirectoryServiceEndpointResourceId
        $galleryEndpoint = $Endpoint.data.galleryUrl
    }

    $azureEnvironmentParams = @{
        Name                                     = $Name
        ActiveDirectoryEndpoint                  = $activeDirectoryEndpoint
        ActiveDirectoryServiceEndpointResourceId = $activeDirectoryServiceEndpointResourceId
        ResourceManagerEndpoint                  = $ResourceManagerEndpoint
        GalleryEndpoint                          = $galleryEndpoint
        GraphEndpoint                            = $graphEndpoint
        GraphAudience                            = $graphAudience
        StorageEndpointSuffix                    = $StorageEndpointSuffix
        AzureKeyVaultDnsSuffix                   = $AzureKeyVaultDnsSuffix
        AzureKeyVaultServiceEndpointResourceId   = $AzureKeyVaultServiceEndpointResourceId
        EnableAdfsAuthentication                 = $aadAuthorityEndpoint.TrimEnd("/").EndsWith("/adfs", [System.StringComparison]::OrdinalIgnoreCase)
    }

    $armEnv = Get-AzureRmEnvironment -Name $name
    if($armEnv -ne $null) {
        Write-Verbose "Updating AzureRm environment $name" -Verbose
        Remove-AzureRmEnvironment -Name $name -Force | Out-Null
    }
    else {
        Write-Verbose "Adding AzureRm environment $name" -Verbose
    }

    return Add-AzureRmEnvironment @azureEnvironmentParams
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
