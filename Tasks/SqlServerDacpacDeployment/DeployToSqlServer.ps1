param (
    [string]$environmentName,
    [string]$adminUserName,
    [string]$adminPassword,
    [string]$protocol,
    [string]$testCertificate,
    [string]$resourceFilteringMethod,
    [string]$machineFilter,
    [string]$dacpacFile,
    [string]$targetMethod,
    [string]$serverName,
    [string]$databaseName,
    [string]$sqlUsername,
    [string]$sqlPassword,
    [string]$connectionString,
    [string]$publishProfile,
    [string]$additionalArguments,
    [string]$deployInParallel
    )

Write-Warning "The preview SQL Server Database Deployment task has been deprecated and will be removed soon. An SQL Server Database Deployment task has been released as an extension in the Visual Studio Team Services marketplace at https://aka.ms/iisextn. Install the extension, and use its tasks in the Build/Release definitions, and delete the preview task from the definition."

Write-Verbose "Entering script DeployToSqlServer.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "adminUserName = $adminUserName" -Verbose
Write-Verbose "winrm protocol to connect to machine  = $protocol" -Verbose
Write-Verbose "testCertificate = $testCertificate" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineFilter = $machineFilter" -Verbose
Write-Verbose "dacpacFile = $dacpacFile" -Verbose
Write-Verbose "targetMethod = $targetMethod" -Verbose
Write-Verbose "serverName = $serverName" -Verbose
Write-Verbose "databaseName = $databaseName" -Verbose
Write-Verbose "sqlUsername = $sqlUsername" -Verbose
Write-Verbose "publishProfile = $publishProfile" -Verbose
Write-Verbose "additionalArguments = $additionalArguments" -Verbose
Write-Verbose "deployInParallel = $deployInParallel" -Verbose

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"

$ErrorActionPreference = 'Stop'

if( $publishProfile -eq $env:SYSTEM_DEFAULTWORKINGDIRECTORY -or $publishProfile -eq [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")){
    $publishProfile = ""
}

$sqlDeploymentScriptPath = Join-Path "$env:AGENT_HOMEDIRECTORY" "Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\Scripts\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Sql.ps1"

if( -Not (Test-Path -Path $sqlDeploymentScriptPath))
{
    $sqlDeploymentScriptPath = Join-Path "$env:AGENT_HOMEDIRECTORY" "externals\vstshost\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\Scripts\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Sql.ps1"
}

$sqlPackageOnTargetMachineBlock = Get-Content $sqlDeploymentScriptPath | Out-String

$sqlPackageArguments = Get-SqlPackageCommandArguments -dacpacFile $dacpacFile -targetMethod $targetMethod -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -publishProfile $publishProfile -additionalArguments $additionalArguments

$scriptArguments = "-sqlPackageArguments $sqlPackageArguments"

$errorMessage = [string]::Empty

Write-Output ( Get-LocalizedString -Key "Starting deployment of Sql Dacpac File : {0}" -ArgumentList $dacpacFile)

if($resourceFilteringMethod -eq "tags")
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -ScriptBlockContent $sqlPackageOnTargetMachineBlock -scriptArguments $scriptArguments -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $protocol -testCertificate $testCertificate
}
else
{
    $errorMessage = Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -ScriptBlockContent $sqlPackageOnTargetMachineBlock -scriptArguments $scriptArguments -runPowershellInParallel $deployInParallel -adminUserName $adminUserName -adminPassword $adminPassword -protocol $protocol -testCertificate $testCertificate 
}

if(-not [string]::IsNullOrEmpty($errorMessage))
{
    $readmelink = "https://aka.ms/sqlserverdacpackreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

$featureFlags = @{
    failDeprecatedBuildTask  = [System.Convert]::ToBoolean($env:FAIL_DEPRECATED_BUILD_TASK)
}
if ($featureFlags.failDeprecatedBuildTask)
{
	throw "The SqlServerDacpacDeployment@1 (SQL Server database deploy) task has been deprecated since October 5, 2018 and will soon be retired. Use the 'IIS Web App Deployment Using WinRM' extension instead: https://marketplace.visualstudio.com/items?itemName=ms-vscs-rm.iiswebapp. For Azure SQL Database use the SqlAzureDacpacDeployment@1 task. Please visit https://aka.ms/azdo-deprecated-tasks to learn more about deprecated tasks."
}

Write-Output ( Get-LocalizedString -Key "Successfully deployed Sql Dacpac File : {0}" -ArgumentList $dacpacFile)