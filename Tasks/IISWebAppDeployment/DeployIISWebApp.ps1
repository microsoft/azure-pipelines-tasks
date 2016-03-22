param (
    [string]$environmentName,
    [string]$adminUserName,
    [string]$adminPassword,
    [string]$winrmProtocol,
    [string]$testCertificate,
    [string]$resourceFilteringMethod,
    [string]$machineFilter,
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams,
    [string]$createWebsite,
    [string]$websiteName,
    [string]$websitePhysicalPath,
    [string]$websitePhysicalPathAuth,
    [string]$websiteAuthUserName,
    [string]$websiteAuthUserPassword,
    [string]$addBinding,
    [string]$assignDuplicateBinding,
    [string]$protocol,
    [string]$ipAddress,
    [string]$port,
    [string]$hostNameWithHttp,
    [string]$hostNameWithOutSNI,
    [string]$hostNameWithSNI,
    [string]$serverNameIndication,
    [string]$sslCertThumbPrint,
    [string]$createAppPool,
    [string]$appPoolName,
    [string]$dotNetVersion,
    [string]$pipeLineMode,
    [string]$appPoolIdentity,
    [string]$appPoolUsername,
    [string]$appPoolPassword,
    [string]$appCmdCommands,
    [string]$deployInParallel
    )

Write-Verbose "Entering script DeployIISWebApp.ps1" -Verbose

$hostName = [string]::Empty

if($protocol -eq "http")
{
    $hostName = $hostNameWithHttp
}
elseif($serverNameIndication -eq "true")
{
    $hostName = $hostNameWithSNI
}
else
{
    $hostName = $hostNameWithOutSNI
}

Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "adminUserName = $adminUserName" -Verbose
Write-Verbose "winrm protocol to connect to machine  = $winrmProtocol" -Verbose
Write-Verbose "testCertificate = $testCertificate" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineFilter = $machineFilter" -Verbose
Write-Verbose "webDeployPackage = $webDeployPackage" -Verbose
Write-Verbose "webDeployParamFile = $webDeployParamFile" -Verbose
Write-Verbose "overRideParams = $overRideParams" -Verbose
Write-Verbose "deployInParallel = $deployInParallel" -Verbose

Write-Verbose "createWebsite = $createWebsite" -Verbose
Write-Verbose "websiteName = $websiteName" -Verbose
Write-Verbose "websitePhysicalPath = $websitePhysicalPath" -Verbose
Write-Verbose "websitePhysicalPathAuth = $websitePhysicalPathAuth" -Verbose
Write-Verbose "websiteAuthUserName = $websiteAuthUserName" -Verbose
Write-Verbose "addBinding = $addBinding" -Verbose
Write-Verbose "assignDuplicateBinding = $assignDuplicateBinding" -Verbose
Write-Verbose "protocol = $protocol" -Verbose
Write-Verbose "ipAddress = $ipAddress" -Verbose
Write-Verbose "port = $port" -Verbose
Write-Verbose "hostName = $hostName" -Verbose
Write-Verbose "serverNameIndication = $serverNameIndication" -Verbose

Write-Verbose "createAppPool = $createAppPool" -Verbose
Write-Verbose "appPoolName = $appPoolName" -Verbose
Write-Verbose "dotNetVersion = $dotNetVersion" -Verbose
Write-Verbose "pipeLineMode = $pipeLineMode" -Verbose
Write-Verbose "appPoolIdentity = $appPoolIdentity" -Verbose
Write-Verbose "appPoolUsername = $appPoolUsername" -Verbose

Write-Verbose "appCmdCommands = $appCmdCommands" -Verbose
Write-Verbose "deployInParallel = $deployInParallel" -Verbose

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"

$webDeployPackage = $webDeployPackage.Trim('"', ' ')
$webDeployParamFile = $webDeployParamFile.Trim('"', ' ')
$websiteName = $websiteName.Trim('"', ' ')
$websitePhysicalPath = $websitePhysicalPath.Trim('"', ' ')
$websiteAuthUserName = $websiteAuthUserName.Trim()

$appPoolName = $appPoolName.Trim('"', ' ')
$appPoolUsername = $appPoolUsername.Trim()

$appCmdCommands = $appCmdCommands.Replace('"', '`"')

if($createWebsite -ieq "true" -and [string]::IsNullOrWhiteSpace($websiteName))
{ 
    throw "Website Name cannot be empty if you want to create or update the target website."
}

if($createAppPool -ieq "true" -and [string]::IsNullOrWhiteSpace($appPoolName))
{ 
    throw "Application pool name cannot be empty if you want to create or update the target app pool."
}

if(![string]::IsNullOrWhiteSpace($websiteName))
{
    if([string]::IsNullOrWhiteSpace($overRideParams))
    {
        Write-Verbose "Adding override params to ensure deployment happens on $websiteName" -Verbose
        $overRideParams = [string]::Format('name="IIS Web Application Name",value="{0}"', $websiteName)
    }
    elseif(!$overRideParams.Contains("IIS Web Application Name")) 
    {
        $overRideParams = $overRideParams + [string]::Format('{0}name="IIS Web Application Name",value="{1}"',  [System.Environment]::NewLine, $websiteName)
    }
}

$overRideParams = $overRideParams.Replace('"', '`"')

$msDeployOnTargetMachinesScript = Get-Content  ./MsDeployOnTargetMachines.ps1 | Out-String
$invokeMain = "Execute-Main -WebDeployPackage `"$webDeployPackage`" -WebDeployParamFile `"$webDeployParamFile`" -OverRideParams `"$overRideParams`" -WebsiteName `"$websiteName`" -WebsitePhysicalPath `"$websitePhysicalPath`" -WebsitePhysicalPathAuth `"$websitePhysicalPathAuth`" -WebsiteAuthUserName `"$websiteAuthUserName`" -WebsiteAuthUserPassword `"$websiteAuthUserPassword`" -AddBinding $addBinding -AssignDuplicateBinding $assignDuplicateBinding -Protocol $protocol -IpAddress `"$ipAddress`" -Port $port -HostName `"$hostName`" -ServerNameIndication $serverNameIndication -SslCertThumbPrint `"$sslCertThumbPrint`" -AppPoolName `"$appPoolName`" -DotNetVersion `"$dotNetVersion`" -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolUsername `"$appPoolUsername`" -AppPoolPassword `"$appPoolPassword`" -AppCmdCommands `"$appCmdCommands`" -CreateWebsite $createWebsite -CreateAppPool $createAppPool"

Write-Verbose "Executing main funnction in MsDeployOnTargetMachines : $invokeMain" -Verbose
$msDeployOnTargetMachinesScriptBlock = [string]::Format("{0} {1} ( {2} )", $msDeployOnTargetMachinesScript,  [Environment]::NewLine,  $invokeMain)

Write-Output ( Get-LocalizedString -Key "Starting deployment of IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)
$errorMessage = [string]::Empty

if($resourceFilteringMethod -eq "tags")
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -scriptBlockContent $msDeployOnTargetMachinesScriptBlock -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $winrmProtocol -testCertificate $testCertificate
}
else
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -scriptBlockContent $msDeployOnTargetMachinesScriptBlock -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $winrmProtocol -testCertificate $testCertificate
}

if(-not [string]::IsNullOrEmpty($errorMessage))
{
    $readmelink = "http://aka.ms/iiswebappdeployreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

Write-Output ( Get-LocalizedString -Key "Successfully deployed IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)