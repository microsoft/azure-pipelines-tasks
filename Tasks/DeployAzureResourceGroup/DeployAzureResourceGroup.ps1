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
    [string]$outputVariable,
    [string]$enableRemoteDeploymentForCreate,
	[string]$enableRemoteDeploymentForSelect
)

Write-Verbose -Verbose "Starting Azure Resource Group Deployment Task"
Write-Verbose -Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose -Verbose "Action = $action"
Write-Verbose -Verbose "ResourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "Location = $location"
Write-Verbose -Verbose "OverrideParameters = $overrideParameters"
Write-Verbose -Verbose "OutputVariable = $outputVariable"
Write-Verbose -Verbose "enableRemoteDeploymentForCreate = $enableRemoteDeploymentForCreate"
Write-Verbose -Verbose "enableRemoteDeploymentForSelect = $enableRemoteDeploymentForSelect"

$resourceGroupName = $resourceGroupName.Trim()
$location = $location.Trim()
$csmFile = $csmFile.Trim('"', ' ')
$csmParametersFile = $csmParametersFile.Trim('"', ' ')
$overrideParameters = $overrideParameters.Trim()
$outputVariable = $outputVariable.Trim()
$telemetrySet = $false
$ErrorActionPreference = "Stop"

# Import all the dlls and modules which have cmdlets we need
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

# Load all dependent files for execution
Import-Module ./Utility.ps1 -Force

function Handle-SelectResourceGroupAction
{
    if([string]::IsNullOrEmpty($outputVariable))
    {
        Write-TaskSpecificTelemetry "PREREQ_NoOutputVariableForSelectActionInAzureRG"
        throw (Get-LocalizedString -Key "Please provide the output variable name since you have specified the 'Select Resource Group' option.")
    }

    if($enableRemoteDeploymentForSelect -eq "true")
    {
	    Enable-WinRMHttpsListener -ResourceGroupName $resourceGroupName
    }

    Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable
}

function Handle-ResourceGroupLifeCycleOperations
{
    $serviceEndpoint = Get-ServiceEndpoint -Name "$ConnectedServiceName" -Context $distributedTaskContext
    if ($serviceEndpoint.Authorization.Scheme -eq 'Certificate')
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidServiceConnectionType"
        throw (Get-LocalizedString -Key "Certificate based authentication only works with the 'Select Resource Group' action. Please select an Azure subscription with either Credential or SPN based authentication.")
    }

    if( $action -eq "Create Or Update Resource Group" )
    {
        $azureResourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersFile $csmParametersFile -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters

        if($enableRemoteDeploymentForCreate -eq "true")
        {
	        Enable-WinRMHttpsListener -ResourceGroupName $resourceGroupName
        }

        if(-not [string]::IsNullOrEmpty($outputVariable))
        {
            Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable
        }
    }
    else
    {
        Perform-Action -action $action -resourceGroupName $resourceGroupName
    }
}

try
{
    Validate-AzurePowerShellVersion

    $azureUtility = Get-AzureUtility
    Write-Verbose -Verbose "Loading $azureUtility"
    Import-Module ./$azureUtility -Force

    switch ($action)
    {
        "Select Resource Group" {
            Handle-SelectResourceGroupAction
            break
        }

        default {
            Handle-ResourceGroupLifeCycleOperations
            break
        }
    }
	
	Write-Verbose -Verbose "Completing Azure Resource Group Deployment Task"
}
catch
{
    Write-TaskSpecificTelemetry "UNKNOWNDEP_Error"
    throw
}