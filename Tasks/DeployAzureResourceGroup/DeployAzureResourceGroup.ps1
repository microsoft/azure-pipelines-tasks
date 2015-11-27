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
$csmFile = $csmFile.Trim('"', ' ')
$csmParametersFile = $csmParametersFile.Trim('"', ' ')
$overrideParameters = $overrideParameters.Trim()
$outputVariable = $outputVariable.Trim()
$telemetrySet = $false

import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

function Write-TaskSpecificTelemetry
{
    param(
      [string]$codeKey
      )

    Write-Telemetry "$codeKey" "94A74903-F93F-4075-884F-DC11F34058B4"
}

$ErrorActionPreference = "Stop"

if(-not $UnderTestCondition)
{
    . ./Utility.ps1
    Import-Module ./AzureUtility.ps1 -Force
}

try
{
    Initialize-GlobalMaps

    Validate-AzurePowershellVersion

    #Handle-SwitchAzureMode
    $isSwitchAzureModeRequired = Is-SwitchAzureModeRequired

    . ./AzureResourceManagerHelper.ps1

    if($isSwitchAzureModeRequired)
    {
    .     ./AzureResourceManagerWrapper.ps1
    }

    if( $action -eq "Select Resource Group")
    {
        if([string]::IsNullOrEmpty($outputVariable))
        {
            Write-TaskSpecificTelemetry "PREREQ_NoOutputVariableForSelectActionInAzureRG"
            throw (Get-LocalizedString -Key "Please provide the output variable name since you have specified the 'Select Resource Group' option.")
        }
    
        Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable
        return
    }

    $serviceEndpoint = Get-ServiceEndpoint -Name "$ConnectedServiceName" -Context $distributedTaskContext
    if ($serviceEndpoint.Authorization.Scheme -eq 'Certificate')
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidServiceConnectionType"
        throw (Get-LocalizedString -Key "Certificate based authentication only works with the 'Select Resource Group' action. Please select an Azure subscription with either Credential or SPN based authentication.")
    }

    if($isSwitchAzureModeRequired)
    {
        Switch-AzureMode AzureResourceManager
    }

    if( $action -eq "Create Or Update Resource Group" )
    {
        Create-AzureResourceGroupHelper -csmFile $csmFile -csmParametersFile $csmParametersFile -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters -isSwitchAzureModeRequired $isSwitchAzureModeRequired
        if(-not [string]::IsNullOrEmpty($outputVariable))
        {
            Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable
        }
    }

    else
    {
        Perform-Action -action $action -resourceGroupName $resourceGroupName
    }

    Write-Verbose -Verbose "Completing Azure Resource Group Deployment Task"
}
catch
{
    if(-not $telemetrySet)
    {
        Write-TaskSpecificTelemetry "UNKNOWN_Error"
    }

    throw
}
