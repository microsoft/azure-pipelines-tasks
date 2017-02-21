Import-Module $PSScriptRoot\ps_modules\TaskModuleIISManageUtility

function Manage-IISWebSite
{
    Trim-Inputs -siteName ([ref]$websiteName) -physicalPath ([ref]$websitePhysicalPath)  -poolName ([ref]$appPoolNameForWebsite) -physicalPathAuthuser ([ref]$websiteAuthUserName) -appPoolUser ([ref]$appPoolUsernameForWebsite) -sslCertThumbPrint ([ref]$sslCertThumbPrint)
    Validate-Inputs -sslCertThumbPrint $sslCertThumbPrint
    
    if ($actionIISWebsite -ieq "CreateOrUpdateWebsite" -and $websitePhysicalPathAuth -ieq "WebsiteWindowsAuth") 
    {
        $websitePhysicalPathAuthCredentials = Get-CustomCredentials -username $websiteAuthUserName -password $websiteAuthUserPassword
    }

    if ($createOrUpdateAppPoolForWebsite -ieq "true" -and $appPoolIdentityForWebsite -ieq "SpecificUser") 
    {
        $appPoolCredentials = Get-CustomCredentials -username $appPoolUsernameForWebsite -password $appPoolPasswordForWebsite
    }

    if($actionIISWebsite -ne "CreateOrUpdateWebsite") 
    {
        $websiteName = $startStopWebsiteName
    }

    Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -PhysicalPath $websitePhysicalPath -PhysicalPathAuth $websitePhysicalPathAuth -PhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -CreateAppPool $createOrUpdateAppPoolForWebsite -AppPoolName $appPoolNameForWebsite -DotNetVersion $dotNetVersionForWebsite -PipeLineMode $pipeLineModeForWebsite -AppPoolIdentity $appPoolIdentityForWebsite -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}

function Manage-IISVirtualDirectory
{
    Trim-Inputs -siteName ([ref]$parentWebsiteNameForVD) -virtualPath ([ref]$virtualPathForVD) -physicalPath ([ref]$physicalPathForVD) -physicalPathAuthuser ([ref]$vdAuthUserName)
    Validate-Inputs -virtualPath $virtualPathForVD

    if ($vdPhysicalPathAuth -ieq "VDWindowsAuth") 
    {
        $vdPhysicalPathAuthCredentials = Get-CustomCredentials -username $vdAuthUserName -password $vdAuthUserPassword     
    }

    Execute-Main -CreateVirtualDirectory $true -WebsiteName $parentWebsiteNameForVD -VirtualPath $virtualPathForVD -PhysicalPath $physicalPathForVD -PhysicalPathAuth $vdPhysicalPathAuth -PhysicalPathAuthCredentials $vdPhysicalPathAuthCredentials -AppCmdCommands $appCmdCommands
}

function Manage-IISWebApplication 
{
    Trim-Inputs -siteName ([ref]$parentWebsiteNameForApplication) -virtualPath ([ref]$virtualPathForApplication) -physicalPath ([ref]$physicalPathForApplication) -physicalPathAuthuser ([ref]$applicationAuthUserName) -poolName ([ref]$appPoolNameForApplication) -appPoolUser ([ref]$appPoolUsernameForApplication) 
    Validate-Inputs -virtualPath $virtualPathForApplication

    if ($applicationPhysicalPathAuth -ieq "ApplicationWindowsAuth") 
    {
        $applicationPhysicalPathAuthCredentials = Get-CustomCredentials -username $applicationAuthUserName -password $applicationAuthUserPassword     
    }

    if ($createOrUpdateAppPoolForApplication -ieq "true" -and $appPoolIdentityForApplication -ieq "SpecificUser") 
    {
        $appPoolCredentials = Get-CustomCredentials -username $appPoolUsernameForApplication -password $appPoolPasswordForApplication
    }

    Execute-Main -CreateApplication $true -WebsiteName $parentWebsiteNameForApplication -VirtualPath $virtualPathForApplication -PhysicalPath $physicalPathForApplication -PhysicalPathAuth $applicationPhysicalPathAuth -PhysicalPathAuthCredentials $ApplicationPhysicalPathAuthCredentials -CreateAppPool $createOrUpdateAppPoolForApplication -AppPoolName $appPoolNameForApplication -DotNetVersion $dotNetVersionForApplication -PipeLineMode $pipeLineModeForApplication -AppPoolIdentity $appPoolIdentityForApplication -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}

function Manage-IISApplicationPool
{
    Trim-Inputs -poolName ([ref]$appPoolName) -appPoolUser ([ref]$appPoolUsername) 

    if ($actionIISApplicationPool -ieq "CreateOrUpdateAppPool" -and $appPoolIdentity -ieq "SpecificUser") 
    {
        $appPoolCredentials = Get-CustomCredentials -username $appPoolUsername -password $appPoolPassword        
    }

    if ($actionIISApplicationPool -ne "CreateOrUpdateAppPool") 
    {
        $appPoolName = $startStopRecycleAppPoolName
    }
    
    Execute-Main -ActionIISApplicationPool $actionIISApplicationPool -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}

function Get-CustomCredentials {

    param (
        [string] $username, 
        [string] $password 
    )

    $secretPassword = "$password" | ConvertTo-SecureString -AsPlainText -Force
    $credentials = New-Object System.Management.Automation.PSCredential ("$username", $secretPassword)

    return $credentials
}

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
        $virtualPath.Value = $virtualPath.Value.Trim('"', ' ').Trim('\', ' ')
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
    param (
        [string] $virtualPath,
        [string] $sslCertThumbPrint
    )

    if((-not [string]::IsNullOrWhiteSpace($sslCertThumbPrint)) -and ($protocol -ieq "https") -and ($addBinding -ieq "true")) 
    {
        if(($sslCertThumbPrint.Length -ne 40) -or (-not [regex]::IsMatch($sslCertThumbPrint, "[a-fA-F0-9]{40}")))
        {
            throw (Get-VstsLocString -Key "InvalidSslThumbprint" )
        }
    }

    if((-not [string]::IsNullOrWhiteSpace($virtualPath)) -and (-not $virtualPath.StartsWith("/")))
    {
        throw (Get-VstsLocString -Key "InvalidVirtualPath")
    }
}