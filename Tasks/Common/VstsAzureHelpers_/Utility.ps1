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
        $pfxFilePassword = [System.String]::Empty
        $bytes = [System.Convert]::FromBase64String($Endpoint.Auth.Parameters.Certificate)
        $certificate.Import($bytes, $pfxFilePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)
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

function Add-CertificateForAz {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)] $Endpoint
    )

    $pemFileContent = $Endpoint.Auth.Parameters.ServicePrincipalCertificate
    $pfxFilePath, $pfxFilePassword = ConvertTo-Pfx -pemFileContent $pemFileContent
   
    # Add the certificate to the cert store.
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxFilePath, $pfxFilePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)

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

# Get the Bearer Access Token for Managed Identity Authentication scheme
function Get-MsiAccessToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)] $endpoint,
        [int] $retryLimit = 5,
        [int] $timeToWait = 2000
    )

    Write-Verbose "Fetching access token for Managed Identity authentication from Azure Instance Metadata Service."

    if ($endpoint.Data.msiClientId) {
        $msiClientIdQueryParameter = "&client_id=$($endpoint.Data.msiClientId)"
    }

    $requestUri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=$($endpoint.Url)$msiClientIdQueryParameter"
    $requestHeaders = @{
        Metadata = "true"
    }

    $trialCount = 1
    $retryableStatusCodes = @(409, 429, 500, 502, 503, 504)

    do {
        try {        
            Write-Verbose "Trial count: $trialCount"
            $response = Invoke-WebRequest -Uri $requestUri -Method "GET" -Headers $requestHeaders -UseBasicParsing
            
            if ($response.StatusCode -eq 200) {
                $responseJson = $response.Content | ConvertFrom-Json
                return $responseJson.access_token
            }
            else {
                throw (Get-VstsLocString -Key AZ_MsiAccessTokenFetchFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
            }
        }
        catch [System.Net.WebException] {
            
            $webExceptionStatus = $_.Exception.Status
            $webExceptionMessage = $_.Exception.Message
			$response = $_.Exception.Response

            if (($webExceptionStatus -eq [System.Net.WebExceptionStatus]::ProtocolError) -and ($response -ne $null)) { 
                
				$responseStatusCode = [int]$_.Exception.Response.StatusCode
                $responseStream = $_.Exception.Response.GetResponseStream()

                if ($responseStream -ne $null) {
                    $reader = New-Object System.IO.StreamReader $responseStream
                    if ($reader.EndOfStream) {
                        $responseStream.Position = 0
                        $reader.DiscardBufferedData()
                    }
           
                    $webExceptionMessage += "`n$($reader.ReadToEnd())"
                }

                if ($responseStatusCode -eq 400) {
                    throw (Get-VstsLocString -Key AZ_MsiAccessNotConfiguredProperlyFailure -ArgumentList $responseStatusCode, $webExceptionMessage)
                }

                if (($retryableStatusCodes -contains $responseStatusCode) -and ($trialCount -lt $retryLimit)) {
                    Write-Verbose (Get-VstsLocString -Key AZ_MsiAccessTokenFetchFailure -ArgumentList $responseStatusCode, $webExceptionMessage)
                    Start-Sleep -m $timeToWait    
                    $trialCount++
                }
                else {
                    # throw error for non-retryable status codes or the trial count exceeded retry limit
                    throw (Get-VstsLocString -Key AZ_MsiAccessTokenFetchFailure -ArgumentList $responseStatusCode, $webExceptionMessage)
                }
            }
            else {
                # we do not have a status code here, so we return the WebExceptionStatus
                throw (Get-VstsLocString -Key AZ_MsiAccessTokenFetchFailure -ArgumentList $webExceptionStatus, $webExceptionMessage)
            }
        }
        catch {
            throw $_.Exception
        }
    }
    while ($trialCount -le $retryLimit)
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

function Get-ProxyUri {
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

    if (CmdletHasMember -cmdlet Set-Content -memberName NoNewline) {
        Set-Content -Path $pfxPasswordFilePath -Value $pfxFilePassword -NoNewline
    }
    else {
        [System.IO.File]::WriteAllText($pfxPasswordFilePath, $pfxFilePassword, [System.Text.Encoding]::ASCII)
    }

    $openSSLExePath = "$PSScriptRoot\openssl\openssl.exe"
    $env:OPENSSL_CONF = "$PSScriptRoot\openssl\openssl.cnf"
    $env:RANDFILE=".rnd"
    
    $openSSLArgs = "pkcs12 -export -in $pemFilePath -out $pfxFilePath -password file:`"$pfxPasswordFilePath`""
     
    Invoke-VstsTool -FileName $openSSLExePath -Arguments $openSSLArgs -RequireExitCodeZero

    return $pfxFilePath, $pfxFilePassword
}

function Get-AzureStackEnvironment {
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

    return $azureEnvironmentParams
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

function Disconnect-AzureAndClearContext {
    [CmdletBinding()]
    param(
        [string]$authScheme = 'ServicePrincipal',
        [string]$restrictContext = 'False'
    )

    try {
        if ($authScheme -eq 'ServicePrincipal') {
            Write-Verbose "Trying to disconnect from Azure and clear context at process scope"

            if (Get-Module Az.Accounts -ListAvailable) {
                Disconnect-UsingAzModule -restrictContext $restrictContext
            }
            else {
                Disconnect-UsingARMModule
            }
        }
    } catch {
        $message = $_.Exception.Message
        Write-Verbose "Unable to disconnect and clear context: $message"
        Write-Host "##vso[task.logissue type=warning;]$message"
    }
}

function Disconnect-UsingAzModule {
    [CmdletBinding()]
    param(
        [string]$restrictContext = 'False'
    )

    if ((Get-Command -Name "Disconnect-AzAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Disconnect-AzAccount -memberName Scope)) {	
        if ($restrictContext -eq 'True') {
            Write-Host "##[command]Disconnect-AzAccount -Scope CurrentUser -ErrorAction Stop"
            $null = Disconnect-AzAccount -Scope CurrentUser -ErrorAction Stop
        }
        Write-Host "##[command]Disconnect-AzAccount -Scope Process -ErrorAction Stop"	
        $null = Disconnect-AzAccount -Scope Process -ErrorAction Stop
    }

    if (Get-Command -Name "Clear-AzContext" -ErrorAction "SilentlyContinue") {
        Write-Host "##[command]Clear-AzContext -Scope Process -ErrorAction Stop"
        $null = Clear-AzContext -Scope Process -ErrorAction Stop
    }
}

function Disconnect-UsingARMModule {
    [CmdletBinding()]
    param()

    if ((Get-Command -Name "Disconnect-AzureRmAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Disconnect-AzureRmAccount -memberName Scope)) {	
        Write-Host "##[command]Disconnect-AzureRmAccount -Scope Process -ErrorAction Stop"	
        $null = Disconnect-AzureRmAccount -Scope Process -ErrorAction Stop
    }
    elseif ((Get-Command -Name "Remove-AzureRmAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Remove-AzureRmAccount -memberName Scope)) {	
        Write-Host "##[command]Remove-AzureRmAccount -Scope Process -ErrorAction Stop"	
        $null = Remove-AzureRmAccount -Scope Process -ErrorAction Stop
    }
    elseif ((Get-Command -Name "Logout-AzureRmAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Logout-AzureRmAccount -memberName Scope)) {	
        Write-Host "##[command]Logout-AzureRmAccount -Scope Process -ErrorAction Stop"	
        $null = Logout-AzureRmAccount -Scope Process -ErrorAction Stop
    }

    if (Get-Command -Name "Clear-AzureRmContext" -ErrorAction "SilentlyContinue") {
        Write-Host "##[command]Clear-AzureRmContext -Scope Process -ErrorAction Stop"
        $null = Clear-AzureRmContext -Scope Process -ErrorAction Stop
    }
}