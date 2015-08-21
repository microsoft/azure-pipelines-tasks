param (
    [string]$environmentName,
    [string]$resourceFilteringMethod,
    [string]$machineFilter,
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams,
    [string]$webSiteName,
    [string]$appPoolName,
    [string]$webSitePhysicalPath,
    [string]$webSitePhysicalPathAuth,
    [string]$webSiteAuthUserName,
    [string]$webSiteAuthUserPassword,
    [string]$addBinding,
    [string]$protocol,
    [string]$ipAddress,
    [string]$port,
    [string]$hostName,
    [string]$serverNameIndication,
    [string]$sslCertThumbPrint,
    [string]$appCmdArgs,
    [string]$deployInParallel
    )

Write-Verbose "Entering script DeployIISWebApp.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineFilter = $machineFilter" -Verbose
Write-Verbose "webDeployPackage = $webDeployPackage" -Verbose
Write-Verbose "webDeployParamFile = $webDeployParamFile" -Verbose
Write-Verbose "overRideParams = $overRideParams" -Verbose
Write-Verbose "deployInParallel = $deployInParallel" -Verbose

Write-Verbose "webSiteName = $webSiteName" -Verbose
Write-Verbose "appPoolName = $appPoolName" -Verbose
Write-Verbose "webSitePhysicalPath = $webSitePhysicalPath" -Verbose
Write-Verbose "webSitePhysicalPathAuth = $webSitePhysicalPathAuth" -Verbose
Write-Verbose "webSiteAuthUserName = $webSiteAuthUserName" -Verbose
Write-Verbose "webSiteAuthUserPassword = $webSiteAuthUserPassword" -Verbose
Write-Verbose "addBinding = $addBinding" -Verbose
Write-Verbose "protocol = $protocol" -Verbose
Write-Verbose "ipAddress = $ipAddress" -Verbose
Write-Verbose "port = $port" -Verbose
Write-Verbose "hostName = $hostName" -Verbose
Write-Verbose "serverNameIndication = $serverNameIndication" -Verbose
Write-Verbose "sslCertThumbPrint = $sslCertThumbPrint" -Verbose
Write-Verbose "appCmdArgs = $appCmdArgs" -Verbose


import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"

$webDeployPackage = $webDeployPackage.Trim('"', ' ')
$webDeployParamFile = $webDeployParamFile.Trim('"', ' ')
$webSiteName = $webSiteName.Trim('"', ' ')
$appPoolName = $appPoolName.Trim('"', ' ')
$webSitePhysicalPath = $webSitePhysicalPath.Trim('"', ' ')


$msDeployOnTargetMachinesBlock = Get-Content  ./MsDeployOnTargetMachines.ps1 | Out-String

$scriptArgs = [string]::Format(' -WebDeployPackage "{0}" -WebDeployParamFile "{1}" -OverRideParams {2}  -WebSiteName "{3}" -AppPoolName "{4}" -WebSitePhysicalPath "{5}" -WebSitePhysicalPathAuth {6} -WebSiteAuthUserName {7} -WebSiteAuthUserPassword {8} -AddBinding {9} -Protocol {10} -IpAddress "{11}" -Port {12} -HostName {13} -ServerNameIndication {14} -SslCertThumbPrint {15} -AppCmdArgs "{16}" -MethodToInvoke Execute-Main', $webDeployPackage, $webDeployParamFile, $overRideParams, $webSiteName, $appPoolName,  $webSitePhysicalPath, $webSitePhysicalPathAuth, $webSiteAuthUserName, $webSiteAuthUserPassword, $addBinding, $protocol, $ipAddress, $port, $hostName, $serverNameIndication, $sslCertThumbPrint, $appCmdArgs)

Write-Verbose "MsDeployOnTargetMachines Script Arguments : $scriptArgs" -Verbose

Write-Output ( Get-LocalizedString -Key "Starting deployment of IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)

if($resourceFilteringMethod -eq "tags")
{
    Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -scriptBlockContent $msDeployOnTargetMachinesBlock -scriptArguments $scriptArgs -runPowershellInParallel $deployInParallel
}
else
{
    Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -scriptBlockContent $msDeployOnTargetMachinesBlock -scriptArguments $scriptArgs -runPowershellInParallel $deployInParallel
}

Write-Output ( Get-LocalizedString -Key "Successfully deployed IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)