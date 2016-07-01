function Assert-SingleItem
{
    Param (
        $Items,
        
        [String]
        $Pattern
    )
    
    if (@($Items).Length -gt 1) 
    {
        throw (Get-VstsLocString -Key ItemSearchMoreThanOneFound -ArgumentList $Pattern) 
    }
    elseif ($Items -eq $null -or @($Items).Length -eq 0)
    {
        throw (Get-VstsLocString -Key ItemSearchNoFilesFound -ArgumentList $Pattern) 
    }
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
    $serverOMDirectory = Get-VstsTaskVariable -Name 'Agent.ServerOMDirectory' -Require
	Add-Type -LiteralPath "$serverOMDirectory\Microsoft.IdentityModel.Clients.ActiveDirectory.dll"	
	$authContext = Create-Object -TypeName Microsoft.IdentityModel.Clients.ActiveDirectory.AuthenticationContext -ArgumentList @($authority)
    $authParams = $ConnectedServiceEndpoint.Auth.Parameters
	$userCredential = Create-Object -TypeName Microsoft.IdentityModel.Clients.ActiveDirectory.UserCredential -ArgumentList @($authParams.Username, $authParams.Password)
    
    # Acquiring a token using UserCredential implies a non-interactive flow. No credential prompts will occur.
    $accessToken = $authContext.AcquireToken($clusterApplicationId, $clientApplicationId, $userCredential).AccessToken

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

    $publishProfile.ClusterConnectionParameters = Read-XmlElementAsHashtable $publishProfileElement.Item("ClusterConnectionParameters")
    $publishProfile.UpgradeDeployment = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment")

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