param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$action,
    [string][Parameter(Mandatory=$true)]$resourceGroupName,
    [string]$location,
    [string]$csmFile,
    [string]$csmParametersFile,
    [string]$overrideParameters,
    # for preventing compat break scenarios passing below parameters also,
    # though we don't require them in current implementation of task
    [string]$dscDeployment,
    [string]$moduleUrlParameterNames,
    [string]$sasTokenParameterNames,
    [string]$vmCreds,
    [string]$vmUserName,
    [string]$vmPassword,
    [string]$skipCACheck
)

Write-Verbose -Verbose "Starting Azure Resource Group Deployment Task"
Write-Verbose -Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose -Verbose "Action = $action"
Write-Verbose -Verbose "ResourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "Location = $location"
Write-Verbose -Verbose "OverrideParameters = $overrideParameters"

$resourceGroupName = $resourceGroupName.Trim()
$location = $location.Trim()
$csmFile = $csmFile.Trim()
$csmParametersFile = $csmParametersFile.Trim()
$overrideParameters = $overrideParameters.Trim()

import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

. ./Utility.ps1

Validate-AzurePowershellVersion

#Handle-SwitchAzureMode
$isSwitchAzureModeRequired = Is-SwitchAzureModeRequired

if($isSwitchAzureModeRequired)
{
    Switch-AzureMode AzureResourceManager
    . ./AzureResourceManagerWrapper.ps1
}

. ./AzureResourceManagerHelper.ps1

if( $action -eq "Create Or Update Resource Group" )
{
    Create-AzureResourceGroupHelper -csmFile $csmFile -csmParametersFile $csmParametersFile -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters -isSwitchAzureModeRequired $isSwitchAzureModeRequired
}
else
{
    Perform-Action -action $action -resourceGroupName $resourceGroupName
}

Write-Verbose -Verbose "Completing Azure Resource Group Deployment Task"