[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

. $PSScriptRoot\Utility.ps1

# Get all inputs 

# Website related inputs 
$actionIISWebsite = Get-VstsInput -Name "ActionIISWebsite"
$websiteName = Get-VstsInput -Name "WebsiteName" 
$startStopWebsiteName = Get-VstsInput -Name "StartStopWebsiteName"
$websitePhysicalPath = Get-VstsInput -Name "WebsitePhysicalPath" 
$websitePhysicalPathAuth = Get-VstsInput -Name "WebsitePhysicalPathAuth" 
$websiteAuthUserName = Get-VstsInput -Name "WebsiteAuthUserName"
$websiteAuthUserPassword = Get-VstsInput -Name "WebsiteAuthUserPassword"
$addBinding = Get-VstsInput -Name "AddBinding"
$bindings = Get-VstsInput -Name "Bindings"
$sslCertThumbPrint = Get-VstsInput -Name "SSLCertThumbPrint"

$createOrUpdateAppPoolForWebsite = Get-VstsInput -Name "CreateOrUpdateAppPoolForWebsite"
$appPoolNameForWebsite = Get-VstsInput -Name "AppPoolNameForWebsite"
$dotNetVersionForWebsite = Get-VstsInput -Name "DotNetVersionForWebsite"
$pipeLineModeForWebsite = Get-VstsInput -Name "PipeLineModeForWebsite"
$appPoolIdentityForWebsite = Get-VstsInput -Name "AppPoolIdentityForWebsite"
$appPoolUsernameForWebsite = Get-VstsInput -Name "AppPoolUsernameForWebsite"
$appPoolPasswordForWebsite = Get-VstsInput -Name "AppPoolPasswordForWebsite"

$configureAuthenticationForWebsite = Get-VstsInput -Name "ConfigureAuthenticationForWebsite"
$anonymousAuthenticationForWebsite = Get-VstsInput -Name "AnonymousAuthenticationForWebsite"
$basicAuthenticationForWebsite = Get-VstsInput -Name "BasicAuthenticationForWebsite"
$windowsAuthenticationForWebsite = Get-VstsInput -Name "WindowsAuthenticationForWebsite"

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
$startStopRecycleAppPoolName = Get-VstsInput -Name "StartStopRecycleAppPoolName"
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
            Set-IISWebsite -actionIISWebsite $actionIISWebsite -websiteName $websiteName -startStopWebsiteName $startStopWebsiteName -physicalPath $websitePhysicalPath -physicalPathAuth $websitePhysicalPathAuth -physicalPathAuthUserName $websiteAuthUserName -physicalPathAuthUserPassword $websiteAuthUserPassword `
                -addBinding $addBinding -bindings $bindings `
                -createOrUpdateAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -dotNetVersion $dotNetVersionForWebsite -pipeLineMode $pipeLineModeForWebsite -appPoolIdentity $appPoolIdentityForWebsite -appPoolUsername $appPoolUsernameForWebsite -appPoolPassword $appPoolPasswordForWebsite `
                -configureAuthentication $configureAuthenticationForWebsite -anonymousAuthentication $anonymousAuthenticationForWebsite -basicAuthentication $basicAuthenticationForWebsite -windowsAuthentication $windowsAuthenticationForWebsite -appCmdCommands $appCmdCommands
        }
        "IISWebApplication" 
        {
            Set-IISWebApplication -parentWebsiteName $parentWebsiteNameForApplication -virtualPath $virtualPathForApplication -physicalPath $physicalPathForApplication -physicalPathAuth $applicationPhysicalPathAuth -physicalPathAuthUserName $applicationAuthUserName -physicalPathAuthUserPassword $applicationAuthUserPassword `
                -createOrUpdateAppPool $createOrUpdateAppPoolForApplication -appPoolName $appPoolNameForApplication -dotNetVersion $dotNetVersionForApplication -pipeLineMode $pipeLineModeForApplication -appPoolIdentity $appPoolIdentityForApplication -appPoolUsername $appPoolUsernameForApplication -appPoolPassword $appPoolPasswordForApplication `
                -appCmdCommands $appCmdCommands

        }
        "IISVirtualDirectory" 
        {
            Set-IISVirtualDirectory -parentWebsiteName $parentWebsiteNameForVD -virtualPath $virtualPathForVD -physicalPath $physicalPathForVD -PhysicalPathAuth  $vdPhysicalPathAuth `
                -physicalPathAuthUserName $vdAuthUserName -physicalPathAuthUserPassword $vdAuthUserPassword -appCmdCommands $appCmdCommands
        }
        "IISApplicationPool" 
        {
            Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
                -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands
        }
        default 
        {
            throw (Get-VstsLocString -Key "InvalidIISDeploymentType" -ArgumentList $iisDeploymentType)
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
