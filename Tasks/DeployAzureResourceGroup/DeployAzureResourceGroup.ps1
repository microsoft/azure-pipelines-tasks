param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$Action,
    [string][Parameter(Mandatory=$true)]$resourceGroupName,    
    [string][Parameter(Mandatory=$true)]$location,    
    [string][Parameter(Mandatory=$true)]$csmFile,    
    [string]$csmParametersFile,
    [string]$overrideParameters,
    [string]$dscDeployment,
    [string]$moduleUrlParameterNames,
    [string]$sasTokenParameterNames,
    [string]$vmCreds,
    [string]$vmUserName,
    [string]$vmPassword,
    [string]$skipCACheck,
    [string]$ResourceFilteringMethodStart,
    [string]$FiltersStart,
    [string]$ResourceFilteringMethodStop,
    [string]$FiltersStop,
    [string]$ResourceFilteringMethodRestart,
    [string]$FiltersRestart,
    [string]$ResourceFilteringMethodDelete,
    [string]$FiltersDelete,
    [string]$ResourceFilteringMethodDeleteRG,
    [string]$FiltersDeleteRG
)

Write-Verbose "Starting Azure Resource Group Deployment Task" -Verbose

Write-Verbose -Verbose "SubscriptionId = $ConnectedServiceName"
Write-Verbose -Verbose "Action = $Action"
Write-Verbose -Verbose "environmentName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "overrideParameters = $overrideParameters"
Write-Verbose -Verbose "moduleUrlParameterNames = $moduleUrlParameterNames"
Write-Verbose -Verbose "sasTokenParamterNames = $sasTokenParameterNames" 

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

. ./DtlServiceHelper.ps1
. ./Utility.ps1

Initialize-DTLServiceHelper
Validate-AzurePowershellVersion

if( $Action -eq "Create Or Update Resource Group" )
{    
    . ./AzureResourceManagerHelper.ps1
    
    Check-EnvironmentNameAvailability -environmentName $resourceGroupName  
    Validate-Credentials -vmCreds $vmCreds -vmUserName $vmUserName -vmPassword $vmPassword

    #Create csm parameter object
    $csmAndParameterFiles = Get-CsmAndParameterFiles -csmFile $csmFile -csmParametersFile $csmParametersFile
    $csmParametersFileContent = [System.IO.File]::ReadAllText($csmAndParameterFiles["csmParametersFile"])          

    $parametersObject = Get-CsmParameterObject -csmParameterFileContent $csmParametersFileContent
    $parametersObject = Refresh-SASToken -moduleUrlParameterNames $moduleUrlParameterNames -sasTokenParameterNames $sasTokenParameterNames -csmParametersObject $parametersObject -subscriptionId $ConnectedServiceName -dscDeployment $dscDeployment

    # Create azure resource group
    Switch-AzureMode AzureResourceManager
    $resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmAndParameterFiles["csmFile"] -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters

    # Update the resource group in DTL
    $subscription = Get-SubscriptionInformation -subscriptionId $ConnectedServiceName
    Update-EnvironemntDetailsInDTL -subscription $subscription -resourceGroupName $resourceGroupName -environmentStatus $resourceGroupDeployment.ProvisioningState    
}
else
{
    # TODO: This is a temporary fix. Will remove it once task json's visibility rul supports conditional operator "!="
    $filterDetails = Get-FilterDetails -action $Action -resourceFilteringMethodStart $ResourceFilteringMethodStart -filtersStart $FiltersStart -resourceFilteringMethodStop $ResourceFilteringMethodStop -filtersStop $FiltersStop `
                                        -resourceFilteringMethodRestart $ResourceFilteringMethodRestart -filtersRestart $FiltersRestart -resourceFilteringMethodDelete $ResourceFilteringMethodDelete -filtersDelete $FiltersDelete `
                                        -resourceFilteringMethodDeleteRG $ResourceFilteringMethodDeleteRG -filtersDeleteRG $FiltersDeleteRG

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

       "Pre-existing machines" {
            . ./PreExistingMachinesHelper.ps1
            break
       }

       default { throw (Get-LocalizedString -Key "Machine group provider is not supported") }
    }

    Perform-Action -action $Action -resourceGroupName $resourceGroupName -resources $machineGroup.Resources -filters $filterDetails["filters"] -ProviderName $providerName
}

Write-Verbose "Completing Azure Resource Group Deployment Task" -Verbose
