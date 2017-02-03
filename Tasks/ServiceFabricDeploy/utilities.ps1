function Get-SinglePathOfType
{
    Param (
        [String]
        $Pattern,

        [ValidateSet("Leaf", "Container")]
        $PathType,

        [Switch]
        $Require
    )

    Write-Host (Get-VstsLocString -Key SearchingForPath -ArgumentList $Pattern)
    if ($Pattern)
    {
        if ($PathType -eq "Container")
        {
            $path = Find-VstsFiles -LegacyPattern $Pattern -IncludeDirectories
        }
        else
        {
            $path = Find-VstsFiles -LegacyPattern $Pattern
        }
    }
    else
    {
        $path = $null
    }

    if (@($path).Length -gt 1) 
    {
        throw (Get-VstsLocString -Key ItemSearchMoreThanOneFound -ArgumentList $Pattern) 
    }
    elseif ($path -eq $null -or @($path).Length -eq 0)
    {
        $noFileFoundMessage = Get-VstsLocString -Key ItemSearchNoFilesFound -ArgumentList $Pattern
        if ($Require)
        {
            throw $noFileFoundMessage
        }
        else
        {
            Write-Host $noFileFoundMessage
        }
    }
    else
    {
        Assert-VstsPath -LiteralPath $path -PathType $PathType
        Write-Host (Get-VstsLocString -Key FoundPath -ArgumentList $path)
    }

    return $path
}

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

function Read-XmlElementAsHashtable
{
    Param (
        [System.Xml.XmlElement]
        $Element
    )

    $hashtable = @{}
    if ($Element.Attributes)
    {
        $Element.Attributes | 
            ForEach-Object {
                # Only boolean values are strongly-typed.  All other values are treated as strings.
                $boolVal = $null
                if ([bool]::TryParse($_.Value, [ref]$boolVal)) {
                    $hashtable[$_.Name] = $boolVal
                }
                else {
                    $hashtable[$_.Name] = $_.Value
                }
            }
    }

    return $hashtable
}

function Read-PublishProfile
{
    Param (
        [String]
        $PublishProfileFile
    )

    $publishProfileXml = [Xml] (Get-Content -LiteralPath $PublishProfileFile)
    $publishProfileElement = $publishProfileXml.PublishProfile
    $publishProfile = @{}

    $publishProfile.UpgradeDeployment = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment")
    $publishProfile.CopyPackageParameters = Read-XmlElementAsHashtable $publishProfileElement.Item("CopyPackageParameters")

    if ($publishProfileElement.Item("UpgradeDeployment"))
    {
        $publishProfile.UpgradeDeployment.Parameters = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment").Item("Parameters")
        if ($publishProfile.UpgradeDeployment["Mode"])
        {
            $publishProfile.UpgradeDeployment.Parameters[$publishProfile.UpgradeDeployment["Mode"]] = $true
        }
    }
    
    $publishProfileFolder = (Split-Path $PublishProfileFile)
    $publishProfile.ApplicationParameterFile = [System.IO.Path]::Combine($publishProfileFolder, $publishProfileElement.ApplicationParameterFile.Path)

    return $publishProfile
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

function Get-VstsUpgradeParameters
{
    Param ()

    $parameters = @{}

    $parameterNames = @(
        "UpgradeReplicaSetCheckTimeoutSec",
        "ReplicaQuorumTimeoutSec",
        "TimeoutSec",
        "ForceRestart"
    )

    $upgradeMode = Get-VstsInput -Name upgradeMode -Require

    $parameters[$upgradeMode] = $true

    if ($upgradeMode -eq "Monitored")
    {
        $parameterNames += @(
            "FailureAction",
            "HealthCheckRetryTimeoutSec",
            "HealthCheckWaitDurationSec",
            "HealthCheckStableDurationSec",
            "UpgradeDomainTimeoutSec",
            "ConsiderWarningAsError",
            "DefaultServiceTypeHealthPolicy",
            "MaxPercentUnhealthyDeployedApplications",
            "UpgradeTimeoutSec",
            "ServiceTypeHealthPolicyMap"
        )
    }

    foreach ($name in $parameterNames)
    {
        $value = Get-VstsInput -Name $name
        if ($value)
        {
            if ($value -eq "false")
            {
                $parameters[$name] = $false
            }
            elseif ($value -eq "true")
            {
                $parameters[$name] = $true
            }
            else
            {
                $parameters[$name] = $value
            }
        }
    }

    $parameters["Force"] = $true

    return $parameters
}