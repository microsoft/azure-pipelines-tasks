function Get-SavedModulePath {
    [CmdletBinding()]
    param([string] $azurePowerShellVersion)
    $savedModulePath = $($env:SystemDrive + "\Modules\az_" + $azurePowerShellVersion)
    Write-Verbose "The value of the module path is: $savedModulePath"
    return $savedModulePath 
}

function Get-SavedModulePathLinux {
    [CmdletBinding()]
    param([string] $azurePowerShellVersion)
    $savedModulePath =  $("/usr/share/az_" + $azurePowerShellVersion)
    Write-Verbose "The value of the module path is: $savedModulePath"
    return $savedModulePath
}

function Update-PSModulePathForHostedAgent {
    [CmdletBinding()]
    param([string] $targetAzurePs)
    try {
        if ($targetAzurePs) {
            $hostedAgentAzModulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs
        }
        else {
            $hostedAgentAzModulePath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        }
        $env:PSModulePath = $hostedAgentAzModulePath + ";" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(';') 
    } finally {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
    }
}

function Update-PSModulePathForHostedAgentLinux {
    [CmdletBinding()]
    param([string] $targetAzurePs)
    try {
        if ($targetAzurePs) {
            $hostedAgentAzModulePath = Get-SavedModulePathLinux -azurePowerShellVersion $targetAzurePs
            if(!(Test-Path $hostedAgentAzModulePath)) {
                Write-Verbose "No module path found with this name"
                throw ("Could not find the module path with given version.")
            }
        }
        else {
            $hostedAgentAzModulePath = Get-LatestModuleLinux -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        }
        $env:PSModulePath = $hostedAgentAzModulePath + ":" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(':') 
    } finally {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
    }
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)
    
    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"

    try {
        $moduleFolders = Get-ChildItem -Directory -Path $($env:SystemDrive + "\Modules") | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"Az\$moduleVersion\Az.psm1")

                if(Test-Path -LiteralPath $modulePath -PathType Leaf) {
                    $maxVersion = $moduleVersion
                    $resultFolder = $moduleFolder.FullName
                } else {
                    Write-Verbose "A folder matching the module folder pattern was found at $($moduleFolder.FullName) but didn't contain a valid module file"
                }
            }
        }
    }
    catch {
        Write-Verbose "Attempting to find the Latest Module Folder failed with the error: $($_.Exception.Message)"
        $resultFolder = ""
    }
    Write-Verbose "Latest module folder detected: $resultFolder"
    return $resultFolder
}

function Get-LatestModuleLinux {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)
    
    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"

    try {
        $moduleFolders = Get-ChildItem -Directory -Path $("/usr/share") | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"Az/$moduleVersion/Az.psm1")

                if(Test-Path -LiteralPath $modulePath -PathType Leaf) {
                    $maxVersion = $moduleVersion
                    $resultFolder = $moduleFolder.FullName
                } else {
                    Write-Verbose "A folder matching the module folder pattern was found at $($moduleFolder.FullName) but didn't contain a valid module file"
                }
            }
        }
    }
    catch {
        Write-Verbose "Attempting to find the Latest Module Folder failed with the error: $($_.Exception.Message)"
        $resultFolder = ""
    }
    Write-Verbose "Latest module folder detected: $resultFolder"
    return $resultFolder
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
    
    "$parameters" # String join the array.
}

# Get the Bearer Access Token for Managed Identity Authentication scheme
function Get-MsiAccessToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)] $endpointObject,
        [int] $retryLimit = 5,
        [int] $timeToWait = 2000
    )

    Write-Verbose "Fetching access token for Managed Identity authentication from Azure Instance Metadata Service."

    if ($endpointObject.msiClientId) {
        $msiClientIdQueryParameter = "&client_id=$($endpointObject.msiClientId)"
    }

    $requestUri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=$($endpointObject.url)$msiClientIdQueryParameter"
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
                throw ("Could not fetch access token for Managed Identity.")
            }
        }
        catch [System.Net.WebException] {
            
            $webExceptionStatus = $_.Exception.Status
            $webExceptionMessage = $_.Exception.Message
			$response = $_.Exception.Response

            if ($webExceptionStatus -eq [System.Net.WebExceptionStatus]::ProtocolError -and $response -ne $null) { 
                
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
                    throw ("Could not fetch access token for Managed Identity. Please configure Managed Identity for virtual machine 'https://aka.ms/azure-msi-docs'.")
                }

                if ($retryableStatusCodes -contains $responseStatusCode -and $trialCount -lt $retryLimit) {
                    Write-Verbose ("Could not fetch access token for Managed Identity.")
                    Start-Sleep -m $timeToWait    
                    $trialCount++
                }
                else {
                    # throw error for non-retryable status codes or the trial count exceeded retry limit
                    throw ("Could not fetch access token for Managed Identity.")
                }
            }
            else {
                # we do not have a status code here, so we return the WebExceptionStatus
                throw ("Could not fetch access token for Managed Identity.")
            }
        }
        catch {
            throw $_.Exception
        }
    }
    while ($trialCount -le $retryLimit)
}

function Get-AzureStackEnvironment {
    param (
        [Parameter(mandatory=$true, HelpMessage="The Admin ARM endpoint of the Azure Stack Environment")]
        $endpointObject,
        [parameter(mandatory=$true, HelpMessage="Azure Stack environment name for use with AzureRM commandlets")]
        [string] $Name
    )

    $EndpointURI = $endpointObject.url.TrimEnd("/")

    $Domain = ""
    try {
        $uriendpoint = [System.Uri] $EndpointURI
        $i = $EndpointURI.IndexOf('.')
        $Domain = ($EndpointURI.Remove(0,$i+1)).TrimEnd('/')
    }
    catch {
        Write-Error ("Specified AzureRM endpoint is invalid.")
    }

    $ResourceManagerEndpoint = $EndpointURI
    $stackdomain = $Domain

    $AzureKeyVaultDnsSuffix="vault.$($stackdomain)".ToLowerInvariant()
    $AzureKeyVaultServiceEndpointResourceId= $("https://vault.$stackdomain".ToLowerInvariant())
    $StorageEndpointSuffix = ($stackdomain).ToLowerInvariant()

    # Check if endpoint data contains required data.
    if($endpointObject.graphUrl -eq $null)
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
        $aadAuthorityEndpoint = $endpointObject.activeDirectoryAuthority.Trim("/") + "/"
        $graphEndpoint = $endpointObject.graphUrl
        $graphAudience = $endpointObject.graphUrl
        $activeDirectoryEndpoint = $endpointObject.activeDirectoryAuthority.Trim("/") + "/"
        $activeDirectoryServiceEndpointResourceId = $endpointObject.activeDirectoryServiceEndpointResourceId
        $galleryEndpoint = $endpointObject.galleryUrl
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

function Add-AzureStackAzEnvironment {
    param (
        [Parameter(mandatory=$true, HelpMessage="The Admin ARM endpoint of the Azure Stack Environment")]
        $Endpoint,
        [parameter(mandatory=$true, HelpMessage="Azure Stack environment name for use with Az commandlets")]
        [string] $Name
    )

    $azureEnvironmentParams = Get-AzureStackEnvironment -endpoint $Endpoint -name $Name

    $armEnv = Get-AzEnvironment -Name $name
    if($armEnv -ne $null) {
        Write-Verbose "Updating Az environment $name" -Verbose
        Remove-AzEnvironment -Name $name | Out-Null       
    }
    else {
        Write-Verbose "Adding Az environment $name" -Verbose
    }

    try {
        return Add-AzEnvironment @azureEnvironmentParams
    }
    catch {
        Assert-TlsError -exception $_.Exception
        throw
    }
}