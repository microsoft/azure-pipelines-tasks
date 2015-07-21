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
    [string]$runPowershellInParallel    
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
Write-Verbose "runPowershellInParallel = $runPowershellInParallel" -Verbose

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"

$sqlPackageArguments = @("/SourceFile:`'$dacpacFile`'")
$sqlPackageArguments += @("/Action:Publish")

if($targetMethod -eq "server")
{
    $sqlPackageArguments += @("/TargetServerName:`'$serverName`'")
    $sqlPackageArguments += @("/TargetDatabaseName:$databaseName")

    if($sqlUsername)
    {
        $sqlPackageArguments += @("/TargetUser:$sqlUsername")
        $sqlPackageArguments += @("/TargetPassword:$sqlPassword")
    }    
}
elseif($targetMethod -eq "connectionString")
{
    $sqlPackageArguments += @("/TargetConnectionString:$connectionString")
}

if($publishProfile)
{
    $sqlPackageArguments += @("/Profile:$publishProfile")
}
$sqlPackageArguments += @("$additionalArguments")

$sqlPackageOnTargetMachineBlock = Get-Content ./SqlPackageOnTargetMachine.ps1 | Out-String

$scriptArgument = '"' + ($sqlPackageArguments -join " ") + '"'

if($resourceFilteringMethod -eq "tags")
{
    Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -scriptBlock $sqlPackageOnTargetMachineBlock -scriptArguments $scriptArgument -runPowershellInParallel $runPowershellInParallel
}
else
{
    Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -scriptBlock $sqlPackageOnTargetMachineBlock -scriptArguments $scriptArgument -runPowershellInParallel $runPowershellInParallel
}