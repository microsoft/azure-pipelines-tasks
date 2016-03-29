import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"


Write-Verbose "Entering script DeployIISWebApp.ps1"

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

function Trim-Inputs([ref]$package, [ref]$paramFile, [ref]$siteName, [ref]$physicalPath, [ref]$poolName, [ref]$websitePathAuthuser, [ref]$appPoolUser, [ref]$adminUser)
{    
    $package.Value = $package.Value.Trim('"', ' ')
    $paramFile.Value = $paramFile.Value.Trim('"', ' ')
    $siteName.Value = $siteName.Value.Trim('"', ' ')
    $physicalPath.Value = $physicalPath.Value.Trim('"', ' ')
    $poolName.Value = $poolName.Value.Trim('"', ' ')
    
    $appPoolUser.Value = $appPoolUser.Value.Trim()
    $websitePathAuthuser.Value = $websitePathAuthuser.Value.Trim()
    $adminUser.Value = $adminUser.Value.Trim()
}

function Validate-Inputs
{
    param(
        [string]$createWebsite,
        [string]$websiteName,
        [string]$createAppPool,
        [string]$appPoolName
    )

    if($createWebsite -ieq "true" -and [string]::IsNullOrWhiteSpace($websiteName))
    { 
        throw "Website Name cannot be empty if you want to create or update the target website."
    }

    if($createAppPool -ieq "true" -and [string]::IsNullOrWhiteSpace($appPoolName))
    { 
        throw "Application pool name cannot be empty if you want to create or update the target app pool."
    }
}

function Compute-MsDeploy-SetParams
{
    param(
        [string]$websiteName,
        [string]$overRideParams
    )

    if(![string]::IsNullOrWhiteSpace($websiteName))
    {
        if([string]::IsNullOrWhiteSpace($overRideParams))
        {
            Write-Verbose "Adding override params to ensure deployment happens on $websiteName"
            $overRideParams = [string]::Format('name="IIS Web Application Name",value="{0}"', $websiteName)
        }
        elseif(!$overRideParams.Contains("IIS Web Application Name")) 
        {
            $overRideParams = $overRideParams + [string]::Format('{0}name="IIS Web Application Name",value="{1}"',  [System.Environment]::NewLine, $websiteName)
        }
    }
    return $overRideParams
}

function Escape-DoubleQuotes
{
    param(
        [string]$str
    )
    return $str.Replace('"', '`"')
}

function Get-ScriptToRun
{
    $msDeployScript = Get-Content  ./MsDeployOnTargetMachines.ps1 | Out-String
    $invokeMain = "Execute-Main -WebDeployPackage `"$webDeployPackage`" -WebDeployParamFile `"$webDeployParamFile`" -OverRideParams `"$overRideParams`" -WebsiteName `"$websiteName`" -WebsitePhysicalPath `"$websitePhysicalPath`" -WebsitePhysicalPathAuth `"$websitePhysicalPathAuth`" -WebsiteAuthUserName `"$websiteAuthUserName`" -WebsiteAuthUserPassword `"$websiteAuthUserPassword`" -AddBinding $addBinding -AssignDuplicateBinding $assignDuplicateBinding -Protocol $protocol -IpAddress `"$ipAddress`" -Port $port -HostName `"$hostName`" -ServerNameIndication $serverNameIndication -SslCertThumbPrint `"$sslCertThumbPrint`" -AppPoolName `"$appPoolName`" -DotNetVersion `"$dotNetVersion`" -PipeLineMode $pipeLineMode -AppPoolIdentity $appPoolIdentity -AppPoolUsername `"$appPoolUsername`" -AppPoolPassword `"$appPoolPassword`" -AppCmdCommands `"$appCmdCommands`" -CreateWebsite $createWebsite -CreateAppPool $createAppPool"

    Write-Verbose "Executing main funnction in MsDeployOnTargetMachines : $invokeMain"
    $msDeployOnTargetMachinesScript = [string]::Format("{0} {1} ( {2} )", $msDeployScript,  [Environment]::NewLine,  $invokeMain)
    return $msDeployOnTargetMachinesScript
}

function Run-RemoteDeployment
{
    param(
        [string]$scriptToRun,
        [string]$filteringMethod,
        [string]$envName,
        [string]$filter,
        [string]$deployInParallel,
        [string]$adminUserName,
        [string]$adminPassword,
        [string]$winrmProtocol,
        [string]$testCertificate
    )

    Write-Output ( Get-LocalizedString -Key "Starting deployment of IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)
    $errorMessage = [string]::Empty

    if($filteringMethod -eq "tags")
    {
        $errorMessage = Invoke-RemoteDeployment -environmentName $envName -tags $filter -scriptBlockContent $scriptToRun -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $winrmProtocol -testCertificate $testCertificate
    }
    else
    {
        $errorMessage = Invoke-RemoteDeployment -environmentName $envName -machineNames $filter -scriptBlockContent $scriptToRun -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $winrmProtocol -testCertificate $testCertificate
    }

    if(-not [string]::IsNullOrEmpty($errorMessage))
    {
        $readmelink = "http://aka.ms/iiswebappdeployreadme"
        $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
        throw "$errorMessage $helpMessage"
    }

    Write-Output ( Get-LocalizedString -Key "Successfully deployed IIS Web Deploy Package : {0}" -ArgumentList $webDeployPackage)
}

function Main
{
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

    $hostName = Get-HostName -protocol $protocol -hostNameWithHttp $hostNameWithHttp -hostNameWithSNI $hostNameWithSNI -hostNameWithOutSNI $hostNameWithOutSNI -sni $serverNameIndication

    Write-Verbose "environmentName = $environmentName"
    Write-Verbose "adminUserName = $adminUserName"
    Write-Verbose "winrm protocol to connect to machine  = $winrmProtocol"
    Write-Verbose "testCertificate = $testCertificate"
    Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod"
    Write-Verbose "machineFilter = $machineFilter"
    Write-Verbose "webDeployPackage = $webDeployPackage"
    Write-Verbose "webDeployParamFile = $webDeployParamFile"
    Write-Verbose "overRideParams = $overRideParams"
    Write-Verbose "deployInParallel = $deployInParallel"

    Write-Verbose "createWebsite = $createWebsite"
    Write-Verbose "websiteName = $websiteName"
    Write-Verbose "websitePhysicalPath = $websitePhysicalPath"
    Write-Verbose "websitePhysicalPathAuth = $websitePhysicalPathAuth"
    Write-Verbose "websiteAuthUserName = $websiteAuthUserName"
    Write-Verbose "addBinding = $addBinding"
    Write-Verbose "assignDuplicateBinding = $assignDuplicateBinding"
    Write-Verbose "protocol = $protocol"
    Write-Verbose "ipAddress = $ipAddress"
    Write-Verbose "port = $port"
    Write-Verbose "hostName = $hostName"
    Write-Verbose "serverNameIndication = $serverNameIndication"

    Write-Verbose "createAppPool = $createAppPool"
    Write-Verbose "appPoolName = $appPoolName"
    Write-Verbose "dotNetVersion = $dotNetVersion"
    Write-Verbose "pipeLineMode = $pipeLineMode"
    Write-Verbose "appPoolIdentity = $appPoolIdentity"
    Write-Verbose "appPoolUsername = $appPoolUsername"

    Write-Verbose "appCmdCommands = $appCmdCommands"
    Write-Verbose "deployInParallel = $deployInParallel"

    Trim-Inputs -package ([ref]$webDeployPackage) -paramFile ([ref]$webDeployParamFile) -siteName ([ref]$websiteName) -physicalPath ([ref]$websitePhysicalPath)  -poolName ([ref]$appPoolName) -websitePathAuthuser ([ref]$websiteAuthUserName) -appPoolUser ([ref]$appPoolUsername) -adminUser ([ref]$adminUserName)

    Validate-Inputs -createWebsite $createWebsite -websiteName $websiteName -createAppPool $createAppPool -appPoolName $appPoolName
    $overRideParams = Compute-MsDeploy-SetParams -websiteName $websiteName -overRideParams $overRideParams
    $appCmdCommands = Escape-DoubleQuotes -str $appCmdCommands
    $overRideParams = Escape-DoubleQuotes -str $overRideParams    
    $script = Get-ScriptToRun
    Run-RemoteDeployment -scriptToRun $script -filteringMethod $resourceFilteringMethod -filter $machineFilter -envName $environmentName -deployInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -winrmProtocol $winrmProtocol -testCertificate $testCertificate
}