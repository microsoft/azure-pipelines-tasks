param (
    [string]$environmentName,
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

Write-Verbose "Entering script DeployToSqlServer.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
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

$sqlDeploymentScriptPath = Join-Path "$env:AGENT_HOMEDIRECTORY" "Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\Scripts\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Sql.ps1"

$sqlPackageOnTargetMachineBlock = Get-Content $sqlDeploymentScriptPath | Out-String

$sqlPackageArguments = Get-SqlPackageCommandArguments -dacpacFile $dacpacFile -targetMethod $targetMethod -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -publishProfile $publishProfile -additionalArguments $additionalArguments

$scriptArguments = "-sqlPackageArguments $sqlPackageArguments"

if($resourceFilteringMethod -eq "tags")
{
    Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -ScriptBlockContent $sqlPackageOnTargetMachineBlock -scriptArguments $scriptArguments -runPowershellInParallel $deployInParallel
}
else
{
    Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -ScriptBlockContent $sqlPackageOnTargetMachineBlock -scriptArguments $scriptArguments -runPowershellInParallel $deployInParallel
}