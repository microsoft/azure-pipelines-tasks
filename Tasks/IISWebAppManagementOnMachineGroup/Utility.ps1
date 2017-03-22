Import-Module $PSScriptRoot\ps_modules\TaskModuleIISManageUtility

function Set-IISWebSite
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
        [string] $appPoolPassword,

        [string] $configureAuthentication,
        [string] $basicAuthentication,
        [string] $windowsAuthentication,

        [string] $appCmdCommands
    )

    switch ($actionIISWebsite) 
    {
        "CreateOrUpdateWebsite" 
        {
            Repair-Inputs -siteName ([ref]$websiteName) -physicalPath ([ref]$physicalPath)  -poolName ([ref]$appPoolName) -physicalPathAuthuser ([ref]$physicalPathAuthUserName) -appPoolUser ([ref]$appPoolUsername) -sslCertThumbPrint ([ref]$sslCertThumbPrint)
            Test-Inputs -sslCertThumbPrint $sslCertThumbPrint -protocol $protocol -addBinding $addBinding
    
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

                Write-Verbose "Initiating action 'create or update' website with user specified application pool."
                Invoke-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -configureAuthentication $configureAuthentication -basicAuthentication $basicAuthentication -windowsAuthentication $windowsAuthentication -AppCmdCommands $appCmdCommands
            }
            else 
            {
                Write-Verbose "Initiating action 'create or update' website"
                Invoke-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -configureAuthentication $configureAuthentication -basicAuthentication $basicAuthentication -windowsAuthentication $windowsAuthentication -AppCmdCommands $appCmdCommands
            }
        }
        {($_ -eq "StartWebsite") -or ($_ -eq "StopWebsite")}
        {
            Repair-Inputs -siteName ([ref]$startStopWebsiteName)
            
            Invoke-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $startStopWebsiteName -AppCmdCommands $appCmdCommands
        }
        default 
        {
            throw (Get-VstsLocString -Key "InvalidActionIISWebsite" -ArgumentList $actionIISWebsite)
        }
    }    
}

function Set-IISVirtualDirectory
{
    param (
        [string] $parentWebsiteName,
        [string] $virtualPath,
        [string] $physicalPath,
        [string] $PhysicalPathAuth,
        [string] $physicalPathAuthUserName,
        [string] $physicalPathAuthUserPassword,
        [string] $appCmdCommands
    )

    Repair-Inputs -siteName ([ref]$parentWebsiteName) -virtualPath ([ref]$virtualPath) -physicalPath ([ref]$physicalPath) -physicalPathAuthuser ([ref]$physicalPathAuthUserName)
    Test-Inputs -virtualPath $virtualPath

    if ($PhysicalPathAuth -eq "VDWindowsAuth") 
    {
        $PhysicalPathAuthCredentials = Get-CustomCredentials -username $physicalPathAuthUserName -password $physicalPathAuthUserPassword     
    }

    Write-Verbose "Initiating action 'create or update' virtual directory."
    Invoke-Main -CreateVirtualDirectory $true -WebsiteName $parentWebsiteName -VirtualPath $virtualPath -PhysicalPath $physicalPath -PhysicalPathAuth $PhysicalPathAuth -PhysicalPathAuthCredentials $PhysicalPathAuthCredentials -AppCmdCommands $appCmdCommands
}

function Set-IISWebApplication 
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
        [string] $appPoolPassword,
        [string] $appCmdCommands
    )

    Repair-Inputs -siteName ([ref]$parentWebsiteName) -virtualPath ([ref]$virtualPath) -physicalPath ([ref]$physicalPath) -physicalPathAuthuser ([ref]$physicalPathAuthUserName) -poolName ([ref]$appPoolName) -appPoolUser ([ref]$appPoolUsername) 
    Test-Inputs -virtualPath $virtualPath

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
        
        Write-Verbose "Initiating action 'create or update' application with user specified application pool."
        Invoke-Main -CreateApplication $true -WebsiteName $parentWebsiteName -VirtualPath $virtualPath -PhysicalPath $physicalPath -PhysicalPathAuth $applicationPhysicalPathAuth -PhysicalPathAuthCredentials $ApplicationPhysicalPathAuthCredentials -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
    }
    else 
    {
        Write-Verbose "Initiating action 'create or update' application."
        Invoke-Main -CreateApplication $true -WebsiteName $parentWebsiteName -VirtualPath $virtualPath -PhysicalPath $physicalPath -PhysicalPathAuth $applicationPhysicalPathAuth -PhysicalPathAuthCredentials $ApplicationPhysicalPathAuthCredentials -AppCmdCommands $appCmdCommands
    }
}

function Set-IISApplicationPool
{
    param (
        [string] $actionIISApplicationPool,
        [string] $appPoolName,
        [string] $startStopRecycleAppPoolName,
        [string] $dotNetVersion,
        [string] $pipeLineMode,
        [string] $appPoolIdentity,
        [string] $appPoolUsername,
        [string] $appPoolPassword,
        [string] $appCmdCommands
    ) 

    switch ($actionIISApplicationPool) 
    {
        "CreateOrUpdateAppPool" 
        {
            Repair-Inputs -poolName ([ref]$appPoolName) -appPoolUser ([ref]$appPoolUsername) 

            if($appPoolIdentity -ieq "SpecificUser") 
            {
                $appPoolCredentials = Get-CustomCredentials -username $appPoolUsername -password $appPoolPassword        
            }

            Write-Verbose "Initiating action 'create or update' application pool."
            Invoke-Main -ActionIISApplicationPool $actionIISApplicationPool -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
        }
        {($_ -eq "StartAppPool") -or ($_ -eq "StopAppPool") -or ($_ -eq "RecycleAppPool")}
        {
            Repair-Inputs -poolName ([ref]$startStopRecycleAppPoolName)

            Invoke-Main -ActionIISApplicationPool $actionIISApplicationPool -AppPoolName $startStopRecycleAppPoolName -AppCmdCommands $appCmdCommands
        }
        default 
        {
            throw (Get-VstsLocString -Key "InvalidActionIISAppPool" -ArgumentList $actionIISApplicationPool)
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

function Repair-Inputs([ref]$siteName, [ref]$physicalPath, [ref]$poolName, [ref]$virtualPath, [ref]$physicalPathAuthuser, [ref]$appPoolUser, [ref]$sslCertThumbPrint)
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
        # Trim all non-hexadecimal characters from the ssl cetificate thumbprint
        if([regex]::IsMatch($sslCertThumbPrint.Value, "[^a-fA-F0-9]+"))
        {
            Write-Warning (Get-VstsLocString -Key "SSLCertWarningInvalidCharacters")
        }

        $sslCertThumbprint.Value = [Regex]::Replace($sslCertThumbprint.Value, "[^a-fA-F0-9]+" , "")

        # Mark the SSL thumbprint value to be a secret value 
        $sslCertThumbprintValue = $sslCertThumbprint.Value
        Write-Host "##vso[task.setvariable variable=f13679253bf44b74afbd244ae83ca735;isSecret=true]$sslCertThumbprintValue"
    }
}

function Test-Inputs
{
    param (
        [string] $virtualPath,
        [string] $sslCertThumbPrint,
        [string] $protocol, 
        [string] $addBinding
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