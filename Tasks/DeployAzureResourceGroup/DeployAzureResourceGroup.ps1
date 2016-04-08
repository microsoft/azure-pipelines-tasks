param(
    [string][Parameter(Mandatory=$true)]$connectedServiceNameSelector,
    [string]$connectedServiceName,
    [string]$connectedServiceNameClassic,
    [string]$action,
    [string]$actionClassic,
    [string]$resourceGroupName,
    [string]$cloudService,
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
    [string]$enableDeploymentPrerequisitesForCreate,
    [string]$enableDeploymentPrerequisitesForSelect
)

Write-Verbose "Starting Azure Resource Group Deployment Task"
Write-Verbose "ConnectedServiceNameSelector = $connectedServiceNameSelector"
Write-Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose "ConnectedServiceNameClassic = $connectedServiceNameClassic"
Write-Verbose "Action = $action"
Write-Verbose "ActionClassic = $actionClassic"
Write-Verbose "ResourceGroupName = $resourceGroupName"
Write-Verbose "CloudService = $cloudService"
Write-Verbose "Location = $location"
Write-Verbose "OverrideParameters = $overrideParameters"
Write-Verbose "OutputVariable = $outputVariable"
Write-Verbose "enableDeploymentPrerequisitesForCreate = $enableDeploymentPrerequisitesForCreate"
Write-Verbose "enableDeploymentPrerequisitesForSelect = $enableDeploymentPrerequisitesForSelect"

if($connectedServiceNameSelector -eq "ConnectedServiceNameClassic")
{
    $connectedServiceName = $connectedServiceNameClassic
    $action = $actionClassic
    $resourceGroupName = $cloudService
}

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

    Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable -enableDeploymentPrerequisites $enableDeploymentPrerequisitesForSelect
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

        if(-not [string]::IsNullOrEmpty($outputVariable))
        {
            Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable -enableDeploymentPrerequisites $enableDeploymentPrerequisitesForCreate
        }
        elseif($enableDeploymentPrerequisitesForCreate -eq "true")
        {
            Enable-WinRMHttpsListener -ResourceGroupName $resourceGroupName
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
    Write-Verbose "Loading $azureUtility"
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
	
	Write-Verbose "Completing Azure Resource Group Deployment Task" -Verbose
}
catch
{
    Write-TaskSpecificTelemetry "UNKNOWNDEP_Error"
    throw
}
