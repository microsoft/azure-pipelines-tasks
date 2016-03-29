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


. ./DeployIISWebApp.ps1

(Main -environmentName $environmentName -adminUserName $adminUserName -adminPassword $adminPassword -winrmProtocol $winrmProtocol -testCertificate $testCertificate -resourceFilteringMethod $resourceFilteringMethod -machineFilter $machineFilter -webDeployPackage "$webDeployPackage" -webDeployParamFile "$webDeployParamFile" -overRideParams "$overRideParams" -createWebsite $createWebsite -websiteName "$websiteName" -websitePhysicalPath "$websitePhysicalPath" -websitePhysicalPathAuth "$websitePhysicalPathAuth" -websiteAuthUserName "$websiteAuthUserName" -websiteAuthUserPassword "$websiteAuthUserPassword" -addBinding $addBinding -assignDuplicateBinding $assignDuplicateBinding -protocol $protocol -ipAddress "$ipAddress" -port $port -hostNameWithHttp "$hostNameWithHttp" -hostNameWithOutSNI "$hostNameWithOutSNI" -hostNameWithSNI "$hostNameWithSNI" -serverNameIndication $serverNameIndication -sslCertThumbPrint "$sslCertThumbPrint" -createAppPool $createAppPool -appPoolName "$appPoolName" -dotNetVersion $dotNetVersion -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername "$appPoolUsername" -appPoolPassword "$appPoolPassword" -appCmdCommands "$appCmdCommands" -deployInParallel $deployInParallel)