param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$action,
    [string][Parameter(Mandatory=$true)]$resourceGroupName,
    [string]$location,
    [string]$csmFile,
    [string]$csmParametersFile,
    [string]$overrideParameters,
    [string]$dscDeployment,
    [string]$moduleUrlParameterNames,
    [string]$sasTokenParameterNames,
    [string]$vmCreds,
    [string]$vmUserName,
    [string]$vmPassword,
    [string]$skipCACheck,
    [string]$resourceFilteringMethodStart,
    [string]$filtersStart,
    [string]$resourceFilteringMethodStop,
    [string]$filtersStop,
    [string]$resourceFilteringMethodRestart,
    [string]$filtersRestart,
    [string]$resourceFilteringMethodDelete,
    [string]$filtersDelete,
    [string]$resourceFilteringMethodDeleteRG,
    [string]$filtersDeleteRG
)

Write-Verbose "Starting Azure Resource Group Deployment Task" -Verbose

Write-Verbose -Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose -Verbose "Action = $action"
Write-Verbose -Verbose "ResourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "Location = $location"
Write-Verbose -Verbose "OverrideParameters = $overrideParameters"
Write-Verbose -Verbose "ModuleUrlParameterNames = $moduleUrlParameterNames"
Write-Verbose -Verbose "SASTokenParamterNames = $sasTokenParameterNames" 

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

. ./DtlServiceHelper.ps1
. ./Utility.ps1

Initialize-DTLServiceHelper
Validate-AzurePowershellVersion

$resourceGroupName = $resourceGroupName.Trim()
$location = $location.Trim()
$csmFile = $csmFile.Trim()
$csmParametersFile = $csmParametersFile.Trim()
$overrideParameters = $overrideParameters.Trim()
$vmUserName = $vmUserName.Trim()
$vmPassword = $vmPassword.Trim()

if( $action -eq "Create Or Update Resource Group" )
{
    . ./AzureResourceManagerHelper.ps1

    Check-EnvironmentNameAvailability -environmentName $resourceGroupName
    Validate-Credentials -vmCreds $vmCreds -vmUserName $vmUserName -vmPassword $vmPassword

    $csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)

    #Create csm parameter object
    $csmAndParameterFiles = Get-CsmAndParameterFiles -csmFile $csmFile -csmParametersFile $csmParametersFile

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY)
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
    $parametersObject = Refresh-SASToken -moduleUrlParameterNames $moduleUrlParameterNames -sasTokenParameterNames $sasTokenParameterNames -csmParametersObject $parametersObject -subscriptionId $currentSubscription.SubscriptionId -dscDeployment $dscDeployment

    # Create azure resource group
    Switch-AzureMode AzureResourceManager

    $resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmAndParameterFiles["csmFile"] -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters

    # Update the resource group in DTL
    Update-EnvironmentDetailsInDTL -subscription $currentSubscription -csmFileName $csmFileName -resourceGroupName $resourceGroupName -environmentStatus $resourceGroupDeployment.ProvisioningState
}
else
{
    # TODO: This is a temporary fix. Will remove it once task json's visibility rule supports conditional operator "!="
    $filterDetails = Get-FilterDetails -action $action -resourceFilteringMethodStart $resourceFilteringMethodStart -filtersStart $filtersStart -resourceFilteringMethodStop $resourceFilteringMethodStop -filtersStop $filtersStop `
                                        -resourceFilteringMethodRestart $resourceFilteringMethodRestart -filtersRestart $filtersRestart -resourceFilteringMethodDelete $resourceFilteringMethodDelete -filtersDelete $filtersDelete `
                                        -resourceFilteringMethodDeleteRG $resourceFilteringMethodDeleteRG -filtersDeleteRG $filtersDeleteRG

    $machineGroup = Get-MachineGroup -machineGroupName $resourceGroupName -filters $filterDetails["filters"]  -resourceFilteringMethod $filterDetails["resourceFilteringMethod"] -Verbose

    $providerName = Get-ProviderHelperFile -machineGroup $machineGroup

    # Loads the required file based on the provider, so that functions in that provider are called.
    Switch ($providerName)
    {
       "AzureResourceGroupManagerV2" {
           . ./AzureResourceManagerHelper.ps1
           Switch-AzureMode AzureResourceManager
           break
       }

       default { throw (Get-LocalizedString -Key "Machine group provider is not supported") }
    }

    Perform-Action -action $action -resourceGroupName $resourceGroupName -resources $machineGroup.Resources -filters $filterDetails["filters"] -ProviderName $providerName
}

Write-Verbose "Completing Azure Resource Group Deployment Task" -Verbose