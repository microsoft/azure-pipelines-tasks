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

Write-Verbose "Starting Azure Resource Group Deployment Task" -Verbose

Write-Verbose -Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose -Verbose "Action = $action"
Write-Verbose -Verbose "ResourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "Location = $location"
Write-Verbose -Verbose "OverrideParameters = $overrideParameters"
Write-Verbose -Verbose "ModuleUrlParameterNames = $moduleUrlParameterNames"
Write-Verbose -Verbose "SASTokenParamterNames = $sasTokenParameterNames" 

import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

. ./Utility.ps1
. ./AzureResourceManagerHelper.ps1

Validate-AzurePowershellVersion

$resourceGroupName = $resourceGroupName.Trim()
$location = $location.Trim()
$csmFile = $csmFile.Trim()
$csmParametersFile = $csmParametersFile.Trim()
$overrideParameters = $overrideParameters.Trim()

if( $action -eq "Create Or Update Resource Group" )
{
    $csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)

    #Create csm parameter object
    $csmAndParameterFiles = Get-CsmAndParameterFiles -csmFile $csmFile -csmParametersFile $csmParametersFile

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\"))
    {
        $csmParametersFileContent = [System.IO.File]::ReadAllText($csmAndParameterFiles["csmParametersFile"])
    }
    else
    {
        $csmParametersFileContent = [String]::Empty
    }

    #Get current subscription
    $currentSubscription = Get-CurrentSubscriptionInformation

    $parametersObject = Get-CsmParameterObject -csmParameterFileContent $csmParametersFileContent

    # Create azure resource group
    Switch-AzureMode AzureResourceManager

    $resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmAndParameterFiles["csmFile"] -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters
}
else
{
    Switch-AzureMode AzureResourceManager

    #Performing action on resource group 
    Perform-Action -action $action -resourceGroupName $resourceGroupName
}

Write-Verbose "Completing Azure Resource Group Deployment Task" -Verbose