[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

Import-Module $PSScriptRoot\ps_modules\TaskModuleIISManageUtility

try {
    
    $CreateWebsite = Get-VstsInput -Name "CreateWebsite"
    $WebsiteName = Get-VstsInput -Name "WebsiteName" 
    $WebsitePhysicalPath = Get-VstsInput -Name "WebsitePhysicalPath" 
    $WebsitePhysicalPathAuth = Get-VstsInput -Name "WebsitePhysicalPathAuth" 
    $WebsiteAuthUserName = Get-VstsInput -Name "WebsiteAuthUserName"
    $WebsiteAuthUserPassword = Get-VstsInput -Name "WebsiteAuthUserPassword"
    $AddBinding = Get-VstsInput -Name "AddBinding"
    $Protocol = Get-VstsInput -Name "Protocol" 
    $IPAddress = Get-VstsInput -Name "IPAddress"
    $Port = Get-VstsInput -Name "Port"
    $ServerNameIndication = Get-VstsInput -Name "ServerNameIndication"
    $HostNameWithOutSNI = Get-VstsInput -Name "HostNameWithOutSNI"
    $HostNameWithHttp = Get-VstsInput -Name "HostNameWithHttpGet"
    $HostNameWithSNI = Get-VstsInput -Name "HostNameWithSNI"
    $SSLCertThumbPrint = Get-VstsInput -Name "SSLCertThumbPrint"

    $CreateAppPool = Get-VstsInput -Name "CreateAppPool"
    $AppPoolName = Get-VstsInput -Name "AppPoolName"
    $DotNetVersion = Get-VstsInput -Name "DotNetVersion"
    $PipeLineMode = Get-VstsInput -Name "PipeLineMode"
    $AppPoolIdentity = Get-VstsInput -Name "AppPoolIdentity"
    $AppPoolUsername = Get-VstsInput -Name "AppPoolUsername"
    $AppPoolPassword = Get-VstsInput -Name "AppPoolPassword"
    $AppCmdCommands = Get-VstsInput -Name "AppCmdCommands"
    $DeployInParallel = Get-VstsInput -Name "DeployInParallel"


    if ($CreateWebsite -and $WebsitePhysicalPathAuth -eq "WebsiteWindowsAuth") {
        $WebsitePhysicalPathAuthPassword = "$WebsiteAuthUserPassword" | ConvertTo-SecureString  -AsPlainText -Force
        $WebsitePhysicalPathAuthCredentials = New-Object System.Management.Automation.PSCredential ("$WebsiteAuthUserName", $WebsitePhysicalPathAuthPassword)
    }

    if ($CreateAppPool -and $AppPoolIdentity -eq "SpecificUser") {
        $AppPoolPassword = "$AppPoolPassword;" | ConvertTo-SecureString  -AsPlainText -Force
        $AppPoolCredentials = New-Object System.Management.Automation.PSCredential ("$AppPoolUsername", $WebsitePhysicalPathAuthPassword)
    }

    Execute-Main -CreateWebsite $createWebsite -WebsiteName $websiteName -WebsitePhysicalPath $websitePhysicalPath -WebsitePhysicalPathAuth $websitePhysicalPathAuth -websitePhysicalPathAuthCredentials $WebsitePhysicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress -Port $port -HostName $hostName -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -CreateAppPool $createAppPool -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $AppPoolCredentials -AppCmdCommands $appCmdCommands
}
catch [Exception] {
    
    Write-Error ($_.Exception.Message)
}
finally {
    Trace-VstsLeavingInvocation $MyInvocation
}