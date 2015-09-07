param (
    [string]$environmentName,
    [string]$resourceFilteringMethod,
    [string]$machineFilter,
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams,
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
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineFilter = $machineFilter" -Verbose
Write-Verbose "webDeployPackage = $webDeployPackage" -Verbose
Write-Verbose "webDeployParamFile = $webDeployParamFile" -Verbose
Write-Verbose "overRideParams = $overRideParams" -Verbose
Write-Verbose "deployInParallel = $deployInParallel" -Verbose

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

$overRideParams = $overRideParams.Replace('"', '''')

$webDeployPackage = $webDeployPackage.Trim('"', ' ')
$webDeployParamFile = $webDeployParamFile.Trim('"', ' ')
$webSiteName = $webSiteName.Trim('"', ' ')
$webSitePhysicalPath = $webSitePhysicalPath.Trim('"', ' ')
$webSiteAuthUserName = $webSiteAuthUserName.Trim()

$appPoolName = $appPoolName.Trim('"', ' ')
$appPoolUsername = $appPoolUsername.Trim()

$appCmdCommands = $appCmdCommands.Replace('"', '`"')

$msDeployOnTargetMachinesBlock = Get-Content  ./MsDeployOnTargetMachines.ps1 | Out-String
$scriptArgs = " -WebDeployPackage `"$webDeployPackage`" -WebDeployParamFile `"$webDeployParamFile`" -OverRideParams `"$overRideParams`"  -WebSiteName `"$webSiteName`" -WebSitePhysicalPath `"$webSitePhysicalPath`" -WebSitePhysicalPathAuth `"$webSitePhysicalPathAuth`" -WebSiteAuthUserName $webSiteAuthUserName -WebSiteAuthUserPassword $webSiteAuthUserPassword -AddBinding $addBinding -AssignDuplicateBinding $assignDuplicateBinding -Protocol $protocol -IpAddress `"$ipAddress`" -Port $port -HostName $hostName -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint -AppPoolName `"$appPoolName`" -DotNetVersion `"$dotNetVersion`" -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolUsername `"$appPoolUsername`" -AppPoolPassword `"$appPoolPassword`" -AppCmdCommands `"$appCmdCommands`""

Write-Verbose "MsDeployOnTargetMachines Script Arguments : $scriptArgs" -Verbose
Write-Output ( Get-LocalizedString -Key "Starting deployment of IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)

$errorMessage = [string]::Empty

if($resourceFilteringMethod -eq "tags")
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -scriptBlockContent $msDeployOnTargetMachinesBlock -scriptArguments $scriptArgs -runPowershellInParallel $deployInParallel
}
else
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -scriptBlockContent $msDeployOnTargetMachinesBlock -scriptArguments $scriptArgs -runPowershellInParallel $deployInParallel
}

if(-not [string]::IsNullOrEmpty($errorMessage))
{
    $readmelink = "http://aka.ms/iiswebappdeployreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

Write-Output ( Get-LocalizedString -Key "Successfully deployed IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)