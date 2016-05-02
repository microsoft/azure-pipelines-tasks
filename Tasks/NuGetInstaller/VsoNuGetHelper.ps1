Add-Type -AssemblyName System.Security

$nuGetTempDirectory = Join-Path $Env:AGENT_BUILDDIRECTORY "NuGet\"
$tempNuGetConfigPath = Join-Path $nuGetTempDirectory "newNuGet.config"

function SaveTempNuGetConfig
{
    [CmdletBinding()]
    param(
        [xml] $nugetConfig        
    )

    if(-not (Test-Path -Path ($nuGetTempDirectory)))
    {
        Write-Verbose "Creating NuGet directory: $nuGetTempDirectory"
        New-Item -Path $nuGetTempDirectory -ItemType Directory
    }

    Write-Host (Get-LocalizedString -Key "Saving to {0}" -ArgumentList $tempNuGetConfigPath)
    $nugetConfig.Save($tempNuGetConfigPath)
}


function EncryptNuGetPassword
{
    [CmdletBinding()]
    param(
        [string] $password
    )

    [Convert]::ToBase64String(
        [System.Security.Cryptography.ProtectedData]::Protect(
            [Text.Encoding]::UTF8.GetBytes($password),
            [Text.Encoding]::UTF8.GetBytes("NuGet"),
            [System.Security.Cryptography.DataProtectionScope]::CurrentUser));
}

function SetNewCredentialElement
{
    [CmdletBinding()]
    param(
        [xml] $nugetConfig,
        [System.Xml.XmlElement] $credentialsSection,
        [string] $credentialKey,
        [string] $password
    )

    $newCredential = $nugetConfig.CreateElement($credentialKey)

    $userNameElement= $nugetConfig.CreateElement("add")
    [void]$userNameElement.SetAttribute("key", "UserName")
    [void]$userNameElement.SetAttribute("value", "VssSessionToken")
    [void]$newCredential.AppendChild($userNameElement)

    $passwordElement = $nugetConfig.CreateElement("add")
    [void]$passwordElement.SetAttribute("key", "Password")
    $encryptedPassword = EncryptNuGetPassword $password
    [void]$passwordElement.SetAttribute("value", $encryptedPassword)
    [void]$newCredential.AppendChild($passwordElement)

    [void]$credentialsSection.AppendChild($newCredential)
}

function ShouldGetCredentialsForFeed
{
    [CmdletBinding()]
    param(
        [Uri]$feedUri
    )

    if(-not ($feedUri.Scheme.Equals("http","InvariantCultureIgnoreCase") -or  $feedUri.Scheme.Equals("https","InvariantCultureIgnoreCase")))
    {
        return $false
    }

    $WebRequestObject = [System.Net.HttpWebRequest] [System.Net.WebRequest]::Create($feedUri);
    try
    {
        $ResponseObject = [System.Net.HttpWebResponse] $WebRequestObject.GetResponse();
    }
    catch [Net.WebException] 
    {
        $ResponseObject = [System.Net.HttpWebResponse] $_.Exception.Response
    }
    
    if($ResponseObject.StatusCode -eq 401)
    {
        $tfsHeaderPresent = $false
        $vssHeaderPresent = $false
        foreach($key in $ResponseObject.Headers.AllKeys)
        {
            if($tfsHeaderPresent -or $key.Contains("X-TFS"))
            {
                $tfsHeaderPresent = $true    
            }

            if($vssHeaderPresent -or $key.Contains("X-VSS"))
            {
                $vssHeaderPresent = $true
            }

            if($tfsHeaderPresent -and $vssHeaderPresent)
            {
                break
            }
        }

        [void]$ResponseObject.Close();
        return $tfsHeaderPresent -and $vssHeaderPresent
    }
    
    return $false
}

function SetCredentialsNuGetConfigAndSaveTemp
{
    [CmdletBinding()]
    param(
        [xml] $nugetConfig,
        [string] $accessToken,
        [uri]$targetFeed
    )

    $credentialsSection = $nugetConfig.SelectSingleNode("configuration/packageSourceCredentials")
    if($credentialsSection -eq $null)
    {
        Write-Verbose "Adding credentials section to NuGet.config"
        #add the packageSourceCredentials node
        $credentialsSection = $nugetConfig.CreateElement("packageSourceCredentials")
        [void]$nugetConfig.configuration.AppendChild($credentialsSection)
    }
    
    $nugetSources = $nugetConfig.SelectNodes("configuration/packageSources/add")
    foreach($nugetSource in $nugetSources)
    {
        if($targetFeed -and (-not $targetFeed.ToString().Equals($nugetSource.value,"InvariantCultureIgnoreCase")))
        {
            Write-Verbose "Source ($nugetSource) skipped, it is not target ($targetFeed)"
            continue
        }

        if(-not (ShouldGetCredentialsForFeed $nugetSource.value))
        {
            continue
        }

        [string]$encodedSource = [System.Xml.XmlConvert]::EncodeLocalName([string]$nugetSource.key)
        if($credentialsSection.SelectSingleNode($encodedSource) -ne $null)
        {
            $credentials = $credentialsSection.SelectSingleNode($encodedSource)
            foreach($section in $credentials.SelectNodes("add"))
            {
                if([string]::Equals(([System.Xml.XmlNode]$section).Attributes["key"].Value, "password", "InvariantCultureIgnoreCase"))
                {
                    Write-Verbose "Setting new credential for $encodedSource"
                    $encryptedPassword = EncryptNuGetPassword $accessToken
                    ([System.Xml.XmlNode]$section).Attributes["value"].Value = $encryptedPassword
                }
            }
        }
        else
        {
            Write-Host (Get-LocalizedString -Key "Setting credentials for {0}" -ArgumentList $([string]$nugetSource.key))
            SetNewCredentialElement $nugetConfig $credentialsSection $encodedSource $accessToken   
        }
    }

    SaveTempNuGetConfig $nugetConfig
}
