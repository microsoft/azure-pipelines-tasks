Import-Module $PSScriptRoot\ps_modules\TaskModuleIISManageUtility

## add appcmd parameter
function Manage-IISWebSite
{
    param (
        [string] $actionIISWebsite,
        [string] $websiteName,
        [string] $startStopWebsiteName,
        [string] $physicalPath,
        [string] $physicalPathAuth,
        [string] $physicalPathAuthUserName,
        [string] $physicalPathAuthUserPassword ,

        [string] $addBinding,
        [string] $protocol,
        [string] $ipAddress,
        [string] $port,
        [string] $serverNameIndication ,

        [string] $hostNameWithOutSNI,
        [string] $hostNameWithHttp,
        [string] $hostNameWithSNI,
        [string] $sslCertThumbPrint,

        [string] $createOrUpdateAppPool,
        [string] $appPoolName,
        [string] $dotNetVersion,
        [string] $pipeLineMode,
        [string] $appPoolIdentity,
        [string] $appPoolUsername,
        [string] $appPoolPassword
    )

    Trim-Inputs -siteName ([ref]$websiteName) -physicalPath ([ref]$physicalPath)  -poolName ([ref]$appPoolName) -physicalPathAuthuser ([ref]$physicalPathAuthUserName) -appPoolUser ([ref]$appPoolUsername) -sslCertThumbPrint ([ref]$sslCertThumbPrint)
    Validate-Inputs -sslCertThumbPrint $sslCertThumbPrint
    
    switch ($actionIISWebsite) 
    {
        "CreateOrUpdateWebsite" 
        {
            if($physicalPathAuth -ieq "WebsiteWindowsAuth") 
            {
                $physicalPathAuthCredentials = Get-CustomCredentials -username $physicalPathAuthUserName -password $physicalPathAuthUserPassword
            }

            if ($createOrUpdateAppPool -eq "true") 
            {
                if($appPoolIdentity -ieq "SpecificUser") 
                {
                    $appPoolCredentials = Get-CustomCredentials -username $appPoolUsername -password $appPoolPassword
                }

                Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
            }
            else 
            {
                Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -AppCmdCommands $appCmdCommands
            }
        }
        {($_ -eq "StartWebsite") -or ($_ -eq "StopWebsite")}
        {
            Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $startStopWebsiteName -AppCmdCommands $appCmdCommands
        }
    }    
}

function Manage-IISVirtualDirectory
{
    param (
        [string] $parentWebsiteName,
        [string] $virtualPath,
        [string] $physicalPath,
        [string] $PhysicalPathAuth,
        [string] $physicalPathAuthUserName,
        [string] $physicalPathAuthUserPassword
    )

    Trim-Inputs -siteName ([ref]$parentWebsiteName) -virtualPath ([ref]$virtualPath) -physicalPath ([ref]$physicalPath) -physicalPathAuthuser ([ref]$physicalPathAuthUserName)
    Validate-Inputs -virtualPath $virtualPath

    if ($PhysicalPathAuth -eq "VDWindowsAuth") 
    {
        $PhysicalPathAuthCredentials = Get-CustomCredentials -username $physicalPathAuthUserName -password $physicalPathAuthUserPassword     
    }

    Execute-Main -CreateVirtualDirectory $true -WebsiteName $parentWebsiteName -VirtualPath $virtualPath -PhysicalPath $physicalPath -PhysicalPathAuth $PhysicalPathAuth -PhysicalPathAuthCredentials $PhysicalPathAuthCredentials -AppCmdCommands $appCmdCommands
}

function Manage-IISWebApplication 
{
    param (
        [string] $parentWebsiteName,
        [string] $virtualPath,
        [string] $physicalPath,
        [string] $physicalPathAuth,
        [string] $physicalPathAuthUserName,
        [string] $physicalPathAuthUserPassword,

        [string] $createOrUpdateAppPool,
        [string] $appPoolName,
        [string] $dotNetVersion,
        [string] $pipeLineMode,
        [string] $appPoolIdentity,
        [string] $appPoolUsername,
        [string] $appPoolPassword
    )

    Trim-Inputs -siteName ([ref]$parentWebsiteName) -virtualPath ([ref]$virtualPath) -physicalPath ([ref]$physicalPath) -physicalPathAuthuser ([ref]$physicalPathAuthUserName) -poolName ([ref]$appPoolName) -appPoolUser ([ref]$appPoolUsername) 
    Validate-Inputs -virtualPath $virtualPath

    if ($physicalPathAuth -eq "ApplicationWindowsAuth") 
    {
        $applicationPhysicalPathAuthCredentials = Get-CustomCredentials -username $physicalPathAuthUserName -password $physicalPathAuthUserPassword     
    }

    if ($createOrUpdateAppPool -eq "true") 
    {
        if($appPoolIdentity -ieq "SpecificUser") 
        {
            $appPoolCredentials = Get-CustomCredentials -username $appPoolUsername -password $appPoolPassword
        }
        
        Execute-Main -CreateApplication $true -WebsiteName $parentWebsiteName -VirtualPath $virtualPath -PhysicalPath $physicalPath -PhysicalPathAuth $applicationPhysicalPathAuth -PhysicalPathAuthCredentials $ApplicationPhysicalPathAuthCredentials -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
    }
    else 
    {
        Execute-Main -CreateApplication $true -WebsiteName $parentWebsiteName -VirtualPath $virtualPath -PhysicalPath $physicalPath -PhysicalPathAuth $applicationPhysicalPathAuth -PhysicalPathAuthCredentials $ApplicationPhysicalPathAuthCredentials -AppCmdCommands $appCmdCommands
    }
}

function Manage-IISApplicationPool
{
    param (
        [string] $actionIISApplicationPool,
        [string] $appPoolName,
        [string] $startStopRecycleAppPoolName,
        [string] $dotNetVersion,
        [string] $pipeLineMode,
        [string] $appPoolIdentity,
        [string] $appPoolUsername,
        [string] $appPoolPassword
    ) 

    Trim-Inputs -poolName ([ref]$appPoolName) -appPoolUser ([ref]$appPoolUsername) 

    switch ($actionIISApplicationPool) 
    {
        "CreateOrUpdateAppPool" 
        {
            if($appPoolIdentity -ieq "SpecificUser") 
            {
                $appPoolCredentials = Get-CustomCredentials -username $appPoolUsername -password $appPoolPassword        
            }

            Execute-Main -ActionIISApplicationPool $actionIISApplicationPool -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
        }
        {($_ -eq "StartAppPool") -or ($_ -eq "StopAppPool") -or ($_ -eq "RecycleAppPool")}
        {
            Execute-Main -ActionIISApplicationPool $actionIISApplicationPool -AppPoolName $startStopRecycleAppPoolName -AppCmdCommands $appCmdCommands
        }
    }
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
        $physicalPath.Value = $physicalPath.Value.Trim('"', ' ').TrimEnd('\')
    }
    if ($virtualPath -ne $null) 
    {
        $virtualPath.Value = $virtualPath.Value.Trim('"', ' ').Trim('\')
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