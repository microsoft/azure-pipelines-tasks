function Get-HostName
{
    param(
        [string]$protocol,
        [string]$hostNameWithHttp,
        [string]$hostNameWithSNI,
        [string]$hostNameWithOutSNI,
        [string]$sni
    )
    $hostName = [string]::Empty

    if($protocol -eq "http")
    {
        $hostName = $hostNameWithHttp
    }
    elseif($sni -eq "true")
    {
        $hostName = $hostNameWithSNI
    }
    else
    {
        $hostName = $hostNameWithOutSNI
    }
    return $hostName
}

function Trim-Inputs([ref]$siteName, [ref]$physicalPath, [ref]$poolName, [ref]$websitePathAuthuser, [ref]$appPoolUser, [ref]$sslCertThumbPrint)
{
    Write-Verbose "Triming inputs for excess spaces, double quotes"

    $siteName.Value = $siteName.Value.Trim('"', ' ')
    $physicalPath.Value = $physicalPath.Value.Trim('"', ' ').Trim('\', ' ')
    $poolName.Value = $poolName.Value.Trim('"', ' ')

    $appPoolUser.Value = $appPoolUser.Value.Trim()
    $websitePathAuthuser.Value = $websitePathAuthuser.Value.Trim()
    $sslCertThumbPrint.Value = $sslCertThumbPrint.Value.Trim()
}

function Validate-Inputs
{
    param(
        [string]$createWebsite,
        [string]$websiteName,
        [string]$createAppPool,
        [string]$appPoolName,
        [string]$addBinding,
        [string]$protocol,
        [string]$sslCertThumbPrint
    )

    Write-Verbose "Validating website and application pool inputs"
    if($createWebsite -ieq "true" -and [string]::IsNullOrWhiteSpace($websiteName))
    { 
        throw "Website Name cannot be empty if you want to create or update the target website."
    }

    if($createAppPool -ieq "true" -and [string]::IsNullOrWhiteSpace($appPoolName))
    { 
        throw "Application pool name cannot be empty if you want to create or update the target app pool."
    }

    if((-not [string]::IsNullOrWhiteSpace($sslCertThumbPrint)) -and ($protocol -ieq "https") -and ($addBinding -ieq "true")) 
    {
        if(($sslCertThumbPrint.Length -ne 40) -or (-not [regex]::IsMatch($sslCertThumbPrint, "[a-fA-F0-9]{40}")))
        {
            throw "Invalid thumbprint. Length is not 40 characters or contains invalid characters."
        }
    }
}

function Escape-SpecialChars
{
    param(
        [string]$str
    )

    return $str.Replace('`', '``').Replace('"', '`"').Replace('$', '`$')
}