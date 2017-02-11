[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

. $PSScriptRoot\Utility.ps1

# Get all inputs 

# Website related inputs 
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

# Virtual directory related inputs 
$parentWebsiteNameForVD = Get-VstsInput -Name "ParentWebsiteNameForVD"
$virtualPathForVD = Get-VstsInput -Name "VirtualPathForVD"
$physicalPathForVD = Get-VstsInput -Name "PhysicalPathForVD"
$vdPhysicalPathAuth = Get-VstsInput -Name "VDPhysicalPathAuth"
$vdAuthUserName = Get-VstsInput -Name "VDAuthUserName"
$vdAuthUserPassword = Get-VstsInput -Name "VDAuthUserPassword"

# Application related inputs 
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

# Application pool related inputs 
$actionIISApplicationPool = Get-VstsInput -Name "ActionIISApplicationPool"
$appPoolName = Get-VstsInput -Name "AppPoolName"
$dotNetVersion = Get-VstsInput -Name "DotNetVersion"
$pipeLineMode = Get-VstsInput -Name "PipeLineMode"
$appPoolIdentity = Get-VstsInput -Name "AppPoolIdentity"
$appPoolUsername = Get-VstsInput -Name "AppPoolUsername"
$appPoolPassword = Get-VstsInput -Name "AppPoolPassword"

# Additional appcmd inputs 
$appCmdCommands = Get-VstsInput -Name "AppCmdCommands"

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
