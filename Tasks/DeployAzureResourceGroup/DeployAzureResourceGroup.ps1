param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName, 
    [string][Parameter(Mandatory=$true)]$location,
    [string][Parameter(Mandatory=$true)]$resourceGroupName,
    [string][Parameter(Mandatory=$true)]$csmFile, 
    [string]$csmParametersFile,
    [string]$dscDeployment,
    [string]$moduleUrlParameterName,
    [string]$sasTokenParameterName
)

Write-Verbose -Verbose "Entering script DeployToAzureResourceGroup.ps1"
Write-Output "Entering script DeployToAzureResourceGroup.ps1"

Write-Verbose -Verbose "SubscriptionId = $ConnectedServiceName"
Write-Verbose -Verbose "environmentName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "deplyomentDefinitionFile = $csmFile"
Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
Write-Verbose -Verbose "moduleUrlParameterName = $moduleUrlParameterName"
Write-Verbose -Verbose "sasTokenParamterName = $sasTokenParameterName"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"
$csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)
$csmFileContent = [System.IO.File]::ReadAllText($csmFile)

if ([string]::IsNullOrEmpty($csmParametersFile) -eq $false)
{
    $csmParametersFileContent = [System.IO.File]::ReadAllText($csmParametersFile)
}

. ./AzureResourceManagerHelper.ps1
. ./DtlServiceHelper.ps1

Check-EnvironmentNameAvailability -environmentName $resourceGroupName

$parametersObject = Get-CsmParameterObject -csmParameterFileContent $csmParametersFileContent
$parametersObject = Refresh-SASToken -moduleUrlParameterName $moduleUrlParameterName -sasTokenParameterName $sasTokenParameterName -csmParametersObject $parametersObject -subscriptionId $ConnectedServiceName -dscDeployment $dscDeployment

Switch-AzureMode AzureResourceManager

$subscription = Get-SubscriptionInformation -subscriptionId $ConnectedServiceName

$resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location

Initialize-DTLServiceHelper

$provider = Create-Provider -providerName "AzureResourceGroupManagerV2" -providerType "Microsoft Azure Compute Resource Provider"

$providerData = Create-ProviderData -providerName $provider.Name -providerDataName $subscription.SubscriptionName -providerDataType $subscription.Environment -subscriptionId $subscription.SubscriptionId

$environmentDefinitionName = [System.String]::Format("{0}_{1}", $csmFileName, $env:BUILD_BUILDNUMBER)

$environmentDefinition = Create-EnvironmentDefinition -environmentDefinitionName $environmentDefinitionName -providerName $provider.Name

$providerDataNames = New-Object System.Collections.Generic.List[string]
$providerDataNames.Add($providerData.Name)

$environmentResources = Get-Resources -resourceGroupName $resourceGroupName

$environment = Create-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $resourceGroupDeployment.ProvisioningState -providerName $provider.ProviderName -providerDataNames $providerDataNames -environmentDefinitionName $environmentDefinition.Name -resources $environmentResources

$environmentOperationId = Create-EnvironmentOperation -environment $environment

Write-Verbose -Verbose  "Leaving script DeployToAzureResourceGroup.ps1"
Write-Output "Leaving script DeployToAzureResourceGroup.ps1"