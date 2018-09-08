function Add-Certificate {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)] $Endpoint,
        [Switch] $ServicePrincipal
    )

    # Add the certificate to the cert store.
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2

    if ($ServicePrincipal) {
        $pemFileContent = $Endpoint.Auth.Parameters.ServicePrincipalCertificate
        $pfxFilePath, $pfxFilePassword = ConvertTo-Pfx -pemFileContent $pemFileContent
        
        $certificate.Import($pfxFilePath, $pfxFilePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)
    }
    else {
        $bytes = [System.Convert]::FromBase64String($Endpoint.Auth.Parameters.Certificate)
        $certificate.Import($bytes)
    }

    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
            ([System.Security.Cryptography.X509Certificates.StoreName]::My),
            ([System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser))
    $store.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))
    $store.Add($certificate)
    $store.Close()

    #store the thumbprint in a global variable which will be used to remove the certificate later on
    $script:Endpoint_Authentication_Certificate = $certificate.Thumbprint
    Write-Verbose "Added certificate to the certificate store."
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
    
    # Clear context only for Azure RM
    if ($Endpoint.Auth.Scheme -eq 'ServicePrincipal' -and !$script:azureModule -and (Get-Command -Name "Clear-AzureRmContext" -ErrorAction "SilentlyContinue")) {
        Write-Host "##[command]Clear-AzureRmContext -Scope Process"
        $null = Clear-AzureRmContext -Scope Process
        Write-Host "##[command]Clear-AzureRmContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
        $null = Clear-AzureRmContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
    }

    $environmentName = "AzureCloud"
    if($Endpoint.Data.Environment) {
        $environmentName = $Endpoint.Data.Environment
        if($environmentName -eq "AzureStack")
        {
            Add-AzureStackAzureRmEnvironment -endpoint $Endpoint -name "AzureStack"
        }
    }
    
    $scopeLevel = "Subscription"
    
    If ($Endpoint.PSObject.Properties['Data'])
    {
        If ($Endpoint.Data.PSObject.Properties['scopeLevel'])
        {
            $scopeLevel = $Endpoint.Data.scopeLevel
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
                Assert-TlsError -exception $_.Exception
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_CredentialsError), $_.Exception))
            }
        }

        # Add account (AzureRM).
        if ($script:azureRMProfileModule) {
            try {
                if (Get-Command -Name "Add-AzureRmAccount" -ErrorAction "SilentlyContinue") {
                    Write-Host "##[command] Add-AzureRMAccount -Credential $psCredential"
                    $null = Add-AzureRMAccount -Credential $psCredential
                } else {
                    Write-Host "##[command] Connect-AzureRMAccount -Credential $psCredential"
                    $null = Connect-AzureRMAccount -Credential $psCredential
                }
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                Assert-TlsError -exception $_.Exception
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
    } 
    elseif ($Endpoint.Auth.Scheme -eq 'ServicePrincipal') {
        
        if ($Endpoint.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
            $servicePrincipalCertificate = Add-Certificate -Endpoint $Endpoint -ServicePrincipal
        }
        else {
            $psCredential = New-Object System.Management.Automation.PSCredential(
                $Endpoint.Auth.Parameters.ServicePrincipalId,
                (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))
        }

        if ($script:azureModule -and $script:azureModule.Version -lt ([version]'0.9.9')) {
            # Service principals arent supported from 0.9.9 and greater in the Azure module.
            try {
                Write-Host "##[command]Add-AzureAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential"
                $null = Add-AzureAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                Assert-TlsError -exception $_.Exception
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
            }

            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        } elseif ($script:azureModule) {
            # Throw if >=0.9.9 Azure.
            throw (Get-VstsLocString -Key "AZ_ServicePrincipalAuthNotSupportedAzureVersion0" -ArgumentList $script:azureModule.Version)
        } else {
            # Else, this is AzureRM.            
            try {
                if (Get-Command -Name "Add-AzureRmAccount" -ErrorAction "SilentlyContinue") {                    
                    if (CmdletHasMember -cmdlet "Add-AzureRMAccount" -memberName "EnvironmentName") {
                        
                        if ($Endpoint.Auth.Parameters.AuthenticationType -eq "SPNCertificate") {
                            Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -EnvironmentName $environmentName"
                            $null = Add-AzureRmAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -CertificateThumbprint $servicePrincipalCertificate.Thumbprint -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId -EnvironmentName $environmentName
                        }
                        else {
                            Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -EnvironmentName $environmentName"
                            $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -EnvironmentName $environmentName
                        }
                    }
                    else {
                        if ($Endpoint.Auth.Parameters.AuthenticationType -eq "SPNCertificate") {
                            Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -Environment $environmentName"
                            $null = Add-AzureRmAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -CertificateThumbprint $servicePrincipalCertificate.Thumbprint -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId -Environment $environmentName
                        }
                        else {
                            Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -Environment $environmentName"
                            $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -Environment $environmentName
                        }
                    }
                }
                else {
                    if ($Endpoint.Auth.Parameters.AuthenticationType -eq "SPNCertificate") {
                        Write-Host "##[command]Connect-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -Environment $environmentName"
                        $null = Connect-AzureRmAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -CertificateThumbprint $servicePrincipalCertificate.Thumbprint -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId -Environment $environmentName
                    }
                    else {
                        Write-Host "##[command]Connect-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -Environment $environmentName"
                        $null = Connect-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -Environment $environmentName
                    }
                }
            } 
            catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                Assert-TlsError -exception $_.Exception
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
            }
            
            if($scopeLevel -eq "Subscription")
            {
                Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
            }
        }
    } elseif ($Endpoint.Auth.Scheme -eq 'ManagedServiceIdentity') {
        $accountId = $env:BUILD_BUILDID 
        if($env:RELEASE_RELEASEID){
            $accountId = $env:RELEASE_RELEASEID 
        }
        $date = Get-Date -Format o
        $accountId = -join($accountId, "-", $date)
        $access_token = Get-MsiAccessToken $Endpoint 0 0
        try {
            Write-Host "##[command]Add-AzureRmAccount  -AccessToken ****** -AccountId $accountId "
            $null = Add-AzureRmAccount -AccessToken $access_token -AccountId $accountId
        } catch {
            # Provide an additional, custom, credentials-related error message.
            Write-VstsTaskError -Message $_.Exception.Message
            throw (New-Object System.Exception((Get-VstsLocString -Key AZ_MsiFailure), $_.Exception))
        }
        
        Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
    }else {
        throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
    } 
}


# Get the Bearer Access Token from the Endpoint
function Get-MsiAccessToken {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)] $endpoint,
        [Parameter(Mandatory=$true)] $retryCount,
        [Parameter(Mandatory=$true)] $timeToWait)

    $msiClientId = "";
    if($endpoint.Data.msiClientId){
        $msiClientId  =  "&client_id=" + $endpoint.Data.msiClientId;
    }
    $tenantId = $endpoint.Auth.Parameters.TenantId

    # Prepare contents for GET
    $method = "GET"
    $apiVersion = "2018-02-01";
    $authUri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + $apiVersion + "&resource=" + $endpoint.Url + $msiClientId;
    
    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token For MSI"
    
    try
    {
        $retryLimit = 5;
        $proxyUri = Get-ProxyUri $authUri
        if ($proxyUri -eq $null)
        {
            Write-Verbose "No proxy settings"
            $response = Invoke-WebRequest -Uri $authUri -Method $method -Headers @{Metadata="true"} -UseBasicParsing
        }
        else
        {
            Write-Verbose "Using Proxy settings"
            $response = Invoke-WebRequest -Uri $authUri -Method $method -Headers @{Metadata="true"} -UseDefaultCredentials -Proxy $proxyUri -ProxyUseDefaultCredentials -UseBasicParsing
        }

        # Action on the based of response 
        if(($response.StatusCode -eq 429) -or ($response.StatusCode -eq 500))
        {
            if($retryCount -lt $retryLimit)
            {
                $retryCount += 1
                $waitedTime = 2000 + $timeToWait * 2
                Start-Sleep -m $waitedTime
                Get-MsiAccessToken $endpoint $retryCount  $waitedTime
            }
            else
            {
                throw (Get-VstsLocString -Key AZ_MsiAccessTokenFetchFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
            }
        }
        elseif ($response.StatusCode -eq 200)
        {
            $accessToken = $response.Content | ConvertFrom-Json
            return $accessToken.access_token
        }
        else
        {
            throw (Get-VstsLocString -Key AZ_MsiAccessNotConfiguredProperlyFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
        }
        
    }
    catch
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "ExceptionMessage: $exceptionMessage (in function: Get-MsiAccessToken)"
        if($exceptionMessage -match "400")
        {
            throw (Get-VstsLocString -Key AZ_MsiAccessNotConfiguredProperlyFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
        }
        else
        {
            throw $_.Exception
        }
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

    if (Get-Command -Name "Select-AzureRmSubscription" -ErrorAction "SilentlyContinue") {
        Write-Host "##[command] Select-AzureRMSubscription -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
        $null = Select-AzureRMSubscription -SubscriptionId $SubscriptionId @additional
    }
    else {
        Write-Host "##[command] Set-AzureRmContext -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
        $null = Set-AzureRmContext -SubscriptionId $SubscriptionId @additional
    }
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
        return $false;
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
        
        if (CmdletHasMember -cmdlet Remove-AzureRmEnvironment -memberName Force) {
            Remove-AzureRmEnvironment -Name $name -Force | Out-Null
        }
        else {
            Remove-AzureRmEnvironment -Name $name | Out-Null
        }        
    }
    else {
        Write-Verbose "Adding AzureRm environment $name" -Verbose
    }

    try {
        return Add-AzureRmEnvironment @azureEnvironmentParams
    }
    catch {
        Assert-TlsError -exception $_.Exception
        throw
    }
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

function ConvertTo-Pfx {
    param(
        [String][Parameter(Mandatory = $true)] $pemFileContent
    )

    if ($ENV:Agent_TempDirectory) {
        $pemFilePath = "$ENV:Agent_TempDirectory\clientcertificate.pem"
        $pfxFilePath = "$ENV:Agent_TempDirectory\clientcertificate.pfx"
        $pfxPasswordFilePath = "$ENV:Agent_TempDirectory\clientcertificatepassword.txt"
    }
    else {
        $pemFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificate.pem"
        $pfxFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificate.pfx"
        $pfxPasswordFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificatepassword.txt"    
    }

    # save the PEM certificate to a PEM file
    Set-Content -Path $pemFilePath -Value $pemFileContent

    # use openssl to convert the PEM file to a PFX file
    $pfxFilePassword = [System.Guid]::NewGuid().ToString()
    Set-Content -Path $pfxPasswordFilePath -Value $pfxFilePassword -NoNewline

    $openSSLExePath = "$PSScriptRoot\openssl\openssl.exe"
    $openSSLArgs = "pkcs12 -export -in $pemFilePath -out $pfxFilePath -password file:`"$pfxPasswordFilePath`""
     
    Invoke-VstsTool -FileName $openSSLExePath -Arguments $openSSLArgs -RequireExitCodeZero

    return $pfxFilePath, $pfxFilePassword
}

function Remove-EndpointSecrets {
    # remove any certificate files
    if (Test-Path -Path "$ENV:System_DefaultWorkingDirectory\clientcertificate.pem") {
        Write-Verbose "Removing file $ENV:System_DefaultWorkingDirectory\clientcertificate.pem"
        Remove-Item -Path "$ENV:System_DefaultWorkingDirectory\clientcertificate.pem"
    }

    if (Test-Path -Path "$ENV:System_DefaultWorkingDirectory\clientcertificate.pfx") {
        Write-Verbose "Removing file $ENV:System_DefaultWorkingDirectory\clientcertificate.pfx"
        Remove-Item -Path "$ENV:System_DefaultWorkingDirectory\clientcertificate.pfx"
    }

    if (Test-Path -Path "$ENV:System_DefaultWorkingDirectory\clientcertificatepassword.txt") {
        Write-Verbose "Removing file $ENV:System_DefaultWorkingDirectory\clientcertificatepassword.txt"
        Remove-Item -Path "$ENV:System_DefaultWorkingDirectory\clientcertificatepassword.txt"
    }

    if ($script:Endpoint_Authentication_Certificate) {
        # remove the certificate from certificate store
        $certificateStore = New-Object System.Security.Cryptography.X509Certificates.X509Store(
            ([System.Security.Cryptography.X509Certificates.StoreName]::My),
            ([System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser))

        $certificateStore.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))

        $certificates =  $certificateStore.Certificates.Find([System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint, $script:Endpoint_Authentication_Certificate, $false)

        foreach ($certificate in $certificates) {
            $certificateStore.Remove($certificate)
        }

        $certificateStore.Close()

        Write-Verbose "Removed certificate from certificate store."
    }
}
