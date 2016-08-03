[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

# Get inputs for the task
$connectedServiceNameSelector = Get-VstsInput -Name "connectedServiceNameSelector" -Require
$connectedServiceName = Get-VstsInput -Name "connectedServiceName"
$connectedServiceNameClassic = Get-VstsInput -Name "connectedServiceNameClassic"
$action = Get-VstsInput -Name "action"
$actionClassic = Get-VstsInput -Name "actionClassic"
$resourceGroupName = Get-VstsInput -Name "resourceGroupName"
$cloudService = Get-VstsInput -Name "cloudService"
$location = Get-VstsInput -Name "location"
$csmFile = Get-VstsInput -Name "csmFile"
$csmParametersFile = Get-VstsInput -Name "csmParametersFile"
$overrideParameters = Get-VstsInput -Name "overrideParameters"
$outputVariable = Get-VstsInput -Name "outputVariable"
$enableDeploymentPrerequisitesForCreate = Get-VstsInput -Name "enableDeploymentPrerequisitesForCreate" -AsBool
$enableDeploymentPrerequisitesForSelect = Get-VstsInput -Name "enableDeploymentPrerequisitesForSelect" -AsBool

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

# Initialize Azure.
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

# Import all the dlls and modules which have cmdlets we need
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"

# Load all dependent files for execution
. "$PSScriptRoot\Utility.ps1"

function Handle-SelectResourceGroupAction
{
    if([string]::IsNullOrEmpty($outputVariable))
    {
        Write-TaskSpecificTelemetry "PREREQ_NoOutputVariableForSelectActionInAzureRG"
        throw (Get-VstsLocString -Key "ARG_ProvideOutputVariable")
    }

    Instantiate-Environment -resourceGroupName $resourceGroupName -outputVariable $outputVariable -enableDeploymentPrerequisites $enableDeploymentPrerequisitesForSelect
}

function Handle-ResourceGroupLifeCycleOperations
{
    $serviceEndpoint = Get-VstsEndpoint -Name "$ConnectedServiceName"
    if ($serviceEndpoint.Auth.Scheme -eq 'Certificate')
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidServiceConnectionType"
        throw (Get-VstsLocString -Key "ARG_UseSpnAuth")
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
    . "$PSScriptRoot\$azureUtility"

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
