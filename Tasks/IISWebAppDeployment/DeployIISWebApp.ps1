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
    [string]$createWebSite,
    [string]$webSiteName,    
    [string]$webSitePhysicalPath,
    [string]$webSitePhysicalPathAuth,
    [string]$webSiteAuthUserName,
    [string]$webSiteAuthUserPassword,
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

Write-Warning "The preview IIS Web App Deployment task has been deprecated and will be removed soon. An IIS Web App Deployment extension has been released in the Visual Studio Team Services marketplace at https://aka.ms/iisextn. Install the extension, and use its tasks in the Build/Release definitions, and delete the preview task from the definition."
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

Write-Verbose "createWebSite = $createWebSite" -Verbose
Write-Verbose "webSiteName = $webSiteName" -Verbose
Write-Verbose "webSitePhysicalPath = $webSitePhysicalPath" -Verbose
Write-Verbose "webSitePhysicalPathAuth = $webSitePhysicalPathAuth" -Verbose
Write-Verbose "webSiteAuthUserName = $webSiteAuthUserName" -Verbose
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
$webSiteName = $webSiteName.Trim('"', ' ')
$webSitePhysicalPath = $webSitePhysicalPath.Trim('"', ' ')
$webSiteAuthUserName = $webSiteAuthUserName.Trim()

$appPoolName = $appPoolName.Trim('"', ' ')
$appPoolUsername = $appPoolUsername.Trim()

$appCmdCommands = $appCmdCommands.Replace('"', '`"')

if($createWebSite -ieq "true" -and [string]::IsNullOrWhiteSpace($webSiteName))
{ 
    throw "Website Name cannot be empty if you want to create or update the target website."
}

if($createAppPool -ieq "true" -and [string]::IsNullOrWhiteSpace($appPoolName))
{ 
    throw "Application pool name cannot be empty if you want to create or update the target app pool."
}


if(![string]::IsNullOrWhiteSpace($webSiteName))
{
    if([string]::IsNullOrWhiteSpace($overRideParams))
    {
        Write-Verbose "Adding override params to ensure deployment happens on $webSiteName" -Verbose
        $overRideParams = [string]::Format('name="IIS Web Application Name",value="{0}"', $webSiteName)
    }
    elseif(!$overRideParams.Contains("IIS Web Application Name")) 
    {
        $overRideParams = $overRideParams + [string]::Format('{0}name="IIS Web Application Name",value="{1}"',  [System.Environment]::NewLine, $webSiteName)
    }
}
$overRideParams = $overRideParams.Replace('"', '`"')
$msDeployScript = Get-Content  ./MsDeployOnTargetMachines.ps1 | Out-String
$invokeMain = "Execute-Main -WebDeployPackage `"$webDeployPackage`" -WebDeployParamFile `"$webDeployParamFile`" -OverRideParams `"$overRideParams`" -WebSiteName `"$webSiteName`" -WebSitePhysicalPath `"$webSitePhysicalPath`" -WebSitePhysicalPathAuth `"$webSitePhysicalPathAuth`" -WebSiteAuthUserName `"$webSiteAuthUserName`" -WebSiteAuthUserPassword `"$webSiteAuthUserPassword`" -AddBinding $addBinding -AssignDuplicateBinding $assignDuplicateBinding -Protocol $protocol -IpAddress `"$ipAddress`" -Port $port -HostName `"$hostName`" -ServerNameIndication $serverNameIndication -SslCertThumbPrint `"$sslCertThumbPrint`" -AppPoolName `"$appPoolName`" -DotNetVersion `"$dotNetVersion`" -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolUsername `"$appPoolUsername`" -AppPoolPassword `"$appPoolPassword`" -AppCmdCommands `"$appCmdCommands`" -CreateWebSite $createWebSite -CreateAppPool $createAppPool"

Write-Verbose "Executing main funnction in MsDeployOnTargetMachines : $invokeMain"
$msDeployOnTargetMachinesScript = [string]::Format("{0} {1} ( {2} )", $msDeployScript,  [Environment]::NewLine,  $invokeMain)
Write-Output ( Get-LocalizedString -Key "Starting deployment of IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)

$errorMessage = [string]::Empty

if($resourceFilteringMethod -eq "tags")
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -scriptBlockContent $msDeployOnTargetMachinesScript -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $winrmProtocol -testCertificate $testCertificate
}
else
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -scriptBlockContent $msDeployOnTargetMachinesScript -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $winrmProtocol -testCertificate $testCertificate
}

if(-not [string]::IsNullOrEmpty($errorMessage))
{
    $readmelink = "https://aka.ms/iiswebappdeployreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

$featureFlags = @{
    failDeprecatedBuildTask  = [System.Convert]::ToBoolean($env:FAIL_DEPRECATED_BUILD_TASK)
}
if ($featureFlags.failDeprecatedBuildTask)
{
	throw "The IISWebAppDeployment@1 (IIS Web App deployment) task has been deprecated since October 5, 2018 and will soon be retired. Use the 'IIS Web App Deployment Using WinRM' extension instead: https://marketplace.visualstudio.com/items?itemName=ms-vscs-rm.iiswebapp. Please see https://aka.ms/azdo-deprecated-tasks for more information about deprecated tasks."
}

Write-Output ( Get-LocalizedString -Key "Successfully deployed IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)