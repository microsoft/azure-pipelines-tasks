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
    [string]$skipCACheck,
    [string]$outputVariable
)

Write-Verbose -Verbose "Starting Azure Resource Group Deployment Task"
Write-Verbose -Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose -Verbose "Action = $action"
Write-Verbose -Verbose "ResourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "Location = $location"
Write-Verbose -Verbose "OverrideParameters = $overrideParameters"
Write-Verbose -Verbose "OutputVariable = $outputVariable"

$resourceGroupName = $resourceGroupName.Trim()
$location = $location.Trim()
$csmFile = $csmFile.Trim()
$csmParametersFile = $csmParametersFile.Trim()
$overrideParameters = $overrideParameters.Trim()
$outputVariable = $outputVariable.Trim()

import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

if(-not $UnderTestCondition)
{
    . ./Utility.ps1
    Import-Module ./AzureUtility.ps1 -Force
}

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
    if(-not [string]::IsNullOrEmpty($outputVariable))
    {
        Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable
    }
}
elseif( $action -eq "SelectRG")
{
    if([string]::IsNullOrEmpty($outputVariable))
    {
        throw (Get-LocalizedString -Key "Please provide the output variable name since you have specified the 'Select Resource Group' option.")
    }
    
    Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable
}
else
{
    Perform-Action -action $action -resourceGroupName $resourceGroupName
}

Write-Verbose -Verbose "Completing Azure Resource Group Deployment Task"