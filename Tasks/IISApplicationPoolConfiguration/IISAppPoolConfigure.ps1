param (
    [string]$environmentName,
    [string]$resourceFilteringMethod,
    [string]$machineNames,
    [string]$applicationPoolName,
    [string]$dotNetVersion,
    [string]$pipeLineMode,
    [string]$identity,
    [string]$username,
    [string]$password,
    [string]$additionalArguments,
    [string]$configureAppPoolInParallel
    )

Write-Verbose "Entering script IISAppPoolConfigure.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "applicationPoolName = $applicationPoolName" -Verbose
Write-Verbose "dotNetVersion = $dotNetVersion" -Verbose
Write-Verbose "pipeLineMode = $pipeLineMode" -Verbose
Write-Verbose "identity = $identity" -Verbose
Write-Verbose "username = $username" -Verbose
Write-Verbose "additionalArguments = $additionalArguments" -Verbose
Write-Verbose "configureAppPoolInParallel = $configureAppPoolInParallel" -Verbose


import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.RemoteDeployment"

#Triming Application pool name, username , password and additional arguments
$applicationPoolName = $applicationPoolName.Trim()
$username = $username.Trim()
$additionalArguments = $additionalArguments.Trim()
$additionalArguments = $additionalArguments.Replace("`"","'")

$iisAppPoolConfigBlock = Get-Content ./IISAppPoolConfigOnTargetMachine.ps1 | Out-String
$ScriptArguments =  "-applicationPoolName `"$applicationPoolName`" -dotNetVersion `"$dotNetVersion`" -pipeLineMode $pipeLineMode -identity $identity -username `"$username`" -password `"$password`" -additionalArguments `"$additionalArguments`" -MethodToInvoke Configure-IISApplicationPool"

Write-Output (Get-LocalizedString -Key "Starting configuration of IIS application pool with name : {0}" -ArgumentList  $applicationPoolName)
if($resourceFilteringMethod -eq "tags")
{
    Invoke-RemoteDeployment -environmentName $environmentName -tags $machineFilter -scriptBlockContent $iisAppPoolConfigBlock -scriptArguments $ScriptArguments -runPowershellInParallel $configureAppPoolInParallel
}
else
{
    Invoke-RemoteDeployment -environmentName $environmentName -machineNames $machineFilter -scriptBlockContent $iisAppPoolConfigBlock -scriptArguments $ScriptArguments  -runPowershellInParallel $configureAppPoolInParallel
}
Write-Output (Get-LocalizedString -Key "Successfully configured IIS application pool with name : {0}" -ArgumentList  $applicationPoolName)