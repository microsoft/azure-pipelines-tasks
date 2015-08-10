param (
    [string]$environmentName,
    [string]$resourceFilteringMethod,
    [string]$machineFilter,
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams,
    [string]$deployInParallel
    )

$ErrorActionPreference = 'Stop'
Write-Verbose "Entering script DeployIISWebApp.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineFilter = $machineFilter" -Verbose
Write-Verbose "webDeployPackage = $webDeployPackage" -Verbose
Write-Verbose "webDeployParamFile = $webDeployParamFile" -Verbose
Write-Verbose "overRideParams = $overRideParams" -Verbose
Write-Verbose "deployInParallel = $deployInParallel" -Verbose

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"

$webDeployPackage = $webDeployPackage.Trim('"', ' ')
$webDeployParamFile = $webDeployParamFile.Trim('"', ' ')

$msDeployOnTargetMachinesBlock = Get-Content  ./MsDeployOnTargetMachines.ps1 | Out-String
$scriptArgs = [string]::Format(' -WebDeployPackage "{0}" -WebDeployParamFile "{1}" -OverRideParams {2} -MethodToInvoke Deploy-WebSite', $webDeployPackage, $webDeployParamFile, $overRideParams)
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