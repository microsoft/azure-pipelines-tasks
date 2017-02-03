[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

. $PSScriptRoot\Utility.ps1
Import-Module $PSScriptRoot\ps_modules\TaskModuleIISManageUtility

function Manage-IISWebSite
{
    $actionIISWebsite = Get-VstsInput -Name "ActionIISWebsite"
    $websiteName = Get-VstsInput -Name "WebsiteName" 
    $websitePhysicalPath = Get-VstsInput -Name "WebsitePhysicalPath" 
    $websitePhysicalPathAuth = Get-VstsInput -Name "WebsitePhysicalPathAuth" 
    $websiteAuthUserName = Get-VstsInput -Name "WebsiteAuthUserName"
    $websiteAuthUserPassword = Get-VstsInput -Name "WebsiteAuthUserPassword"
    $addBinding = Get-VstsInput -Name "AddBinding"
    $protocol = Get-VstsInput -Name "Protocol" 
    $ipAddress = Get-VstsInput -Name "IPAddress"
    $port = Get-VstsInput -Name "Port"
    $serverNameIndication = Get-VstsInput -Name "ServerNameIndication"
    $hostNameWithOutSNI = Get-VstsInput -Name "HostNameWithOutSNI"
    $hostNameWithHttp = Get-VstsInput -Name "HostNameWithHttp"
    $hostNameWithSNI = Get-VstsInput -Name "HostNameWithSNI"
    $sslCertThumbPrint = Get-VstsInput -Name "SSLCertThumbPrint"

    $createOrUpdateAppPoolForWebsite = Get-VstsInput -Name "CreateOrUpdateAppPoolForWebsite"
    $appPoolNameForWebsite = Get-VstsInput -Name "AppPoolNameForWebsite"
    $dotNetVersionForWebsite = Get-VstsInput -Name "DotNetVersionForWebsite"
    $pipeLineModeForWebsite = Get-VstsInput -Name "PipeLineModeForWebsite"
    $appPoolIdentityForWebsite = Get-VstsInput -Name "AppPoolIdentityForWebsite"
    $appPoolUsernameForWebsite = Get-VstsInput -Name "AppPoolUsernameForWebsite"
    $appPoolPasswordForWebsite = Get-VstsInput -Name "AppPoolPasswordForWebsite"

    $appCmdCommands = Get-VstsInput -Name "AppCmdCommands"

    $hostName = Get-HostName -protocol $protocol -hostNameWithHttp $hostNameWithHttp -hostNameWithSNI $hostNameWithSNI -hostNameWithOutSNI $hostNameWithOutSNI -sni $serverNameIndication

    Trim-Inputs -siteName ([ref]$websiteName) -physicalPath ([ref]$websitePhysicalPath)  -poolName ([ref]$appPoolNameForWebsite) -physicalPathAuthuser ([ref]$websiteAuthUserName) -appPoolUser ([ref]$appPoolUsernameForWebsite) -sslCertThumbPrint ([ref]$sslCertThumbPrint)

    Validate-Inputs -actionIISWebsite $actionIISWebsite -websiteName $websiteName -createAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -addBinding $addBinding -protocol $protocol -sslCertThumbPrint $sslCertThumbPrint

    if ($actionIISWebsite -ieq "CreateOrUpdateWebsite" -and $websitePhysicalPathAuth -ieq "WebsiteWindowsAuth") {
        $websiteAuthUserPassword = Escape-SpecialChars -str $WebsiteAuthUserPassword
        $websitePhysicalPathAuthPassword = "$websiteAuthUserPassword" | ConvertTo-SecureString -AsPlainText -Force
        $websitePhysicalPathAuthCredentials = New-Object System.Management.Automation.PSCredential ("$websiteAuthUserName", $websitePhysicalPathAuthPassword)
    }

    if ($createOrUpdateAppPoolForWebsite -ieq "true" -and $appPoolIdentityForWebsite -ieq "SpecificUser") {
        $appPoolPasswordForWebsite = Escape-SpecialChars -str $appPoolPasswordForWebsite
        $appPoolPasswordForWebsite = "$appPoolPasswordForWebsite" | ConvertTo-SecureString -AsPlainText -Force
        $appPoolCredentials = New-Object System.Management.Automation.PSCredential ("$appPoolUsernameForWebsite", $appPoolPasswordForWebsite)
    }

    $appCmdCommands = Escape-SpecialChars -str $appCmdCommands

    Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -PhysicalPath $websitePhysicalPath -PhysicalPathAuth $websitePhysicalPathAuth -PhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostName $hostName -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -CreateAppPool $createOrUpdateAppPoolForWebsite -AppPoolName $appPoolNameForWebsite -DotNetVersion $dotNetVersionForWebsite -PipeLineMode $pipeLineModeForWebsite -AppPoolIdentity $appPoolIdentityForWebsite -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}

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

function Manage-IISVirtualDirectory
{
    $parentWebsiteNameForVD = Get-VstsInput -Name "ParentWebsiteNameForVD"
    $applicationName = Get-VstsInput -Name "ApplicationName"
    $virtualPathForVD = Get-VstsInput -Name "VirtualPathForVD"
    $physicalPathForVD = Get-VstsInput -Name "PhysicalPathForVD"
    $vdPhysicalPathAuth = Get-VstsInput -Name "VDPhysicalPathAuth"
    $vdAuthUserName = Get-VstsInput -Name "VDAuthUserName"
    $vdAuthUserPassword = Get-VstsInput -Name "VDAuthUserPassword"

    $appCmdCommands = Get-VstsInput -Name "AppCmdCommands"

    Trim-Inputs -siteName ([ref]$parentWebsiteNameForVD) -virtualPath ([ref]$virtualPathForVD) -physicalPath ([ref]$physicalPathForVD) -physicalPathAuthuser ([ref]$vdAuthUserName)

    if ($vdPhysicalPathAuth -ieq "VDWindowsAuth") {
        $vdAuthUserPassword = Escape-SpecialChars -str $vdAuthUserPassword
        $vdPhysicalPathAuthPassword = "$vdAuthUserPassword" | ConvertTo-SecureString -AsPlainText -Force
        $vdPhysicalPathAuthCredentials = New-Object System.Management.Automation.PSCredential ("$vdAuthUserName", $vdPhysicalPathAuthPassword)
    }

    $appCmdCommands = Escape-SpecialChars -str $appCmdCommands
    
    Execute-Main -CreateVirtualDirectory $true -WebsiteName $parentWebsiteNameForVD -applicationPath $applicationName -VirtualPath $virtualPathForVD -PhysicalPath $physicalPathForVD -PhysicalPathAuth $vdPhysicalPathAuth -PhysicalPathAuthCredentials $vdPhysicalPathAuthCredentials -AppCmdCommands $appCmdCommands
}

function Manage-IISWebApplication 
{
    $parentWebsiteNameForApplication = Get-VstsInput -Name "ParentWebsiteNameForApplication"
    $virtualPathForApplication = Get-VstsInput -Name "VirtualPathForApplication"
    $physicalPathForApplication = Get-VstsInput -Name "PhysicalPathForApplication"
    $applicationPhysicalPathAuth = Get-VstsInput -Name "ApplicationPhysicalPathAuth"
    $applicationAuthUserName = Get-VstsInput -Name "ApplicationAuthUserName"
    $applicationAuthUserPassword = Get-VstsInput -Name "ApplicationAuthUserPassword"
    
    $createOrUpdateAppPoolForApplication = Get-VstsInput -Name "CreateOrUpdateAppPoolForApplication"
    $appPoolNameForApplication = Get-VstsInput -Name "AppPoolNameForApplication"
    $dotNetVersionForApplication = Get-VstsInput -Name "DotNetVersionForApplication"
    $pipeLineModeForApplication = Get-VstsInput -Name "PipeLineModeForApplication"
    $appPoolIdentityForApplication = Get-VstsInput -Name "AppPoolIdentityForApplication"
    $appPoolUsernameForApplication = Get-VstsInput -Name "AppPoolUsernameForApplication"
    $appPoolPasswordForApplication = Get-VstsInput -Name "AppPoolPasswordForApplication"

    $appCmdCommands = Get-VstsInput -Name "AppCmdCommands"

    Trim-Inputs -siteName ([ref]$parentWebsiteNameForApplication) -virtualPath ([ref]$virtualPathForApplication) -physicalPath ([ref]$physicalPathForApplication) -physicalPathAuthuser ([ref]$applicationAuthUserName) -poolName ([ref]$appPoolNameForApplication) -appPoolUser ([ref]$appPoolUsernameForApplication) 

    Validate-Inputs -createAppPool $createOrUpdateAppPoolForApplication -appPoolName $appPoolNameForApplication

    if ($applicationPhysicalPathAuth -ieq "ApplicationWindowsAuth") {
        $applicationAuthUserPassword = Escape-SpecialChars -str $applicationAuthUserPassword
        $applicationPhysicalPathAuthPassword = "$applicationAuthUserPassword" | ConvertTo-SecureString -AsPlainText -Force
        $ApplicationPhysicalPathAuthCredentials = New-Object System.Management.Automation.PSCredential ("$applicationAuthUserName", $applicationPhysicalPathAuthPassword)
    }

    if ($createOrUpdateAppPoolForApplication -ieq "true" -and $appPoolIdentityForApplication -ieq "SpecificUser") 
    {
        $appPoolPasswordForApplication = Escape-SpecialChars -str $appPoolPasswordForApplication
        $appPoolPasswordForApplication = "$appPoolPasswordForApplication" | ConvertTo-SecureString -AsPlainText -Force
        $appPoolCredentials = New-Object System.Management.Automation.PSCredential ("$appPoolUsernameForApplication", $appPoolPasswordForApplication)
    }

    $appCmdCommands = Escape-SpecialChars -str $appCmdCommands
    
    Execute-Main -CreateApplication $true -WebsiteName $parentWebsiteNameForApplication -VirtualPath $virtualPathForApplication -PhysicalPath $physicalPathForApplication -PhysicalPathAuth $applicationPhysicalPathAuth -PhysicalPathAuthCredentials $ApplicationPhysicalPathAuthCredentials -CreateAppPool $createOrUpdateAppPoolForApplication -AppPoolName $appPoolNameForApplication -DotNetVersion $dotNetVersionForApplication -PipeLineMode $pipeLineModeForApplication -AppPoolIdentity $appPoolIdentityForApplication -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}

function Manage-IISApplicationPool
{
    $actionIISApplicationPool = Get-VstsInput -Name "ActionIISApplicationPool"
    $appPoolName = Get-VstsInput -Name "AppPoolName"
    $dotNetVersion = Get-VstsInput -Name "DotNetVersion"
    $pipeLineMode = Get-VstsInput -Name "PipeLineMode"
    $appPoolIdentity = Get-VstsInput -Name "AppPoolIdentity"
    $appPoolUsername = Get-VstsInput -Name "AppPoolUsername"
    $appPoolPassword = Get-VstsInput -Name "AppPoolPassword"
    $appCmdCommands = Get-VstsInput -Name "AppCmdCommands"
    
    Trim-Inputs -poolName ([ref]$appPoolName) -appPoolUser ([ref]$appPoolUsername) 

    Validate-Inputs -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName

    if ($actionIISApplicationPool -ieq "CreateOrUpdateAppPool" -and $appPoolIdentity -ieq "SpecificUser") 
    {
        $appPoolPassword = Escape-SpecialChars -str $appPoolPassword
        $appPoolPassword = "$appPoolPassword" | ConvertTo-SecureString -AsPlainText -Force
        $appPoolCredentials = New-Object System.Management.Automation.PSCredential ("$appPoolUsername", $appPoolPassword)
    }

    $appCmdCommands = Escape-SpecialChars -str $appCmdCommands

    Execute-Main -ActionIISApplicationPool $actionIISApplicationPool -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}

try {
    
    $iisDeploymentType = Get-VstsInput -Name "IISDeploymentType"

    switch ($iisDeploymentType)
    {
        "IISWebsite" 
        {
            Manage-IISWebsite
            break
        }
        "IISWebApplication" 
        {
            Manage-IISWebApplication
            break
        }
        "IISVirtualDirectory" 
        {
            Manage-IISVirtualDirectory
            break
        }
        "IISApplicationPool" 
        {
            Manage-IISApplicationPool
        }
    }
}
catch [Exception] 
{    
    Write-Error ($_.Exception.Message)
}
finally 
{
    Trace-VstsLeavingInvocation $MyInvocation
}
