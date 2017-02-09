[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

. $PSScriptRoot\Utility.ps1
Import-Module $PSScriptRoot\ps_modules\TaskModuleIISManageUtility

try {
    
    $createWebsite = Get-VstsInput -Name "CreateWebsite"
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

    $createAppPool = Get-VstsInput -Name "CreateAppPool"
    $appPoolName = Get-VstsInput -Name "AppPoolName"
    $dotNetVersion = Get-VstsInput -Name "DotNetVersion"
    $pipeLineMode = Get-VstsInput -Name "PipeLineMode"
    $appPoolIdentity = Get-VstsInput -Name "AppPoolIdentity"
    $appPoolUsername = Get-VstsInput -Name "AppPoolUsername"
    $appPoolPassword = Get-VstsInput -Name "AppPoolPassword"
    $appCmdCommands = Get-VstsInput -Name "AppCmdCommands"
    $deployInParallel = Get-VstsInput -Name "DeployInParallel"

    $hostName = Get-HostName -protocol $protocol -hostNameWithHttp $hostNameWithHttp -hostNameWithSNI $hostNameWithSNI -hostNameWithOutSNI $hostNameWithOutSNI -sni $serverNameIndication
    
    Trim-Inputs -siteName ([ref]$websiteName) -physicalPath ([ref]$websitePhysicalPath)  -poolName ([ref]$appPoolName) -websitePathAuthuser ([ref]$websiteAuthUserName) -appPoolUser ([ref]$appPoolUsername) -sslCertThumbPrint ([ref]$sslCertThumbPrint)

    Validate-Inputs -createWebsite $createWebsite -websiteName $websiteName -createAppPool $createAppPool -appPoolName $appPoolName -addBinding $addBinding -protocol $protocol -sslCertThumbPrint $sslCertThumbPrint
    
    if ($createWebsite -and $websitePhysicalPathAuth -ieq "WebsiteWindowsAuth") {
        $websiteAuthUserPassword = Escape-SpecialChars -str $WebsiteAuthUserPassword
        $websitePhysicalPathAuthPassword = "$websiteAuthUserPassword" | ConvertTo-SecureString -AsPlainText -Force
        $websitePhysicalPathAuthCredentials = New-Object System.Management.Automation.PSCredential ("$websiteAuthUserName", $websitePhysicalPathAuthPassword)
    }

    if ($createAppPool -and $appPoolIdentity -ieq "SpecificUser") {
        $appPoolPassword = Escape-SpecialChars -str $appPoolPassword
        $appPoolPassword = "$appPoolPassword" | ConvertTo-SecureString -AsPlainText -Force
        $appPoolCredentials = New-Object System.Management.Automation.PSCredential ("$appPoolUsername", $appPoolPassword)
    }

    $appCmdCommands = Escape-SpecialChars -str $appCmdCommands

    Execute-Main -CreateWebsite $createWebsite -WebsiteName $websiteName -WebsitePhysicalPath $websitePhysicalPath -WebsitePhysicalPathAuth $websitePhysicalPathAuth -websitePhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostName $hostName -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -CreateAppPool $createAppPool -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands
}
catch [Exception] {
    
    Write-Error ($_.Exception.Message)
}
finally {
    Trace-VstsLeavingInvocation $MyInvocation
}