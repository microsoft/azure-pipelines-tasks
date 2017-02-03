
function Trim-Inputs([ref]$siteName, [ref]$physicalPath, [ref]$poolName, [ref]$virtualPath, [ref]$physicalPathAuthuser, [ref]$appPoolUser, [ref]$sslCertThumbPrint)
{
    Write-Verbose "Triming inputs for excess spaces, double quotes"

    if ($siteName -ne $null) 
    {
        $siteName.Value = $siteName.Value.Trim('"', ' ')
    }
    if ($physicalPath -ne $null) 
    {
        $physicalPath.Value = $physicalPath.Value.Trim('"', ' ').Trim('\', ' ')
    }
    if ($virtualPath -ne $null) 
    {
        ## check
        $virtualPath.Value = $virtualPath.Value.Trim('"', ' ').Trim('\', ' ').Trim('/', ' ')
    }
    if ($poolName -ne $null) 
    {
        $poolName.Value = $poolName.Value.Trim('"', ' ')
    }
    if ($appPoolUser -ne $null) 
    {
        $appPoolUser.Value = $appPoolUser.Value.Trim()
    }
    if ($physicalPathAuthuser -ne $null) 
    {
        $physicalPathAuthuser.Value = $physicalPathAuthuser.Value.Trim()
    }
    if ($sslCertThumbPrint -ne $null) 
    {
        $sslCertThumbPrint.Value = $sslCertThumbPrint.Value.Trim()
    }
}

function Validate-Inputs
{
    param(
        [string]$actionIISWebsite,
        [string]$actionIISApplicationPool,
        [string]$websiteName,
        [string]$createAppPool,
        [string]$appPoolName,
        [string]$addBinding,
        [string]$protocol,
        [string]$sslCertThumbPrint
    )

    Write-Verbose "Validating website and application pool inputs"
    if(($createWebsite -ieq "true" -or $actionIISWebsite -ieq "CreateOrUpdateWebsite") -and [string]::IsNullOrWhiteSpace($websiteName))
    { 
        throw "Website Name cannot be empty if you want to create or update the target website."
    }

    if(($createAppPool -ieq "true" -or $actionIISApplicationPool -ieq "CreateOrUpdateAppPool") -and [string]::IsNullOrWhiteSpace($appPoolName))
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

    if([string]::IsNullOrWhiteSpace($str)) 
    {
        return $null
    } 
    
    return $str.Replace('`', '``').Replace('"', '`"').Replace('$', '`$')
}