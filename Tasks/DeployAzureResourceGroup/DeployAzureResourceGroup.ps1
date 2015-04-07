param(
    [string]$ConnectedServiceName, 
    [string]$location,
    [string]$resourceGroupName,
    [string]$csmFile, 
    [string]$csmParametersFile,
    [string]$fullBlobUri,
    [string]$sasTokenParameterName
)

Write-Verbose -Verbose "Entering script DeployToAzureResourceGroup.ps1"
Write-Output "Entering script DeployToAzureResourceGroup.ps1"

Write-Verbose -Verbose "SubscriptionId = $ConnectedServiceName"
Write-Verbose -Verbose "environmentName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "deplyomentDefinitionFile = $csmFile"
Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
Write-Verbose -Verbose "blobName = $blobName"
Write-Verbose -Verbose "sasTokenParamterName = $sasTokenParameterName"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)
$csmFileContent = [System.IO.File]::ReadAllText($csmFile)
$csmParametersFileContent = [System.IO.File]::ReadAllText($csmParametersFile)

. ./AzureResourceManagerHelper.ps1
. ./DtlServiceHelper.ps1

$parametersObject = Refresh-SASToken -fullBlobUri  $fullBlobUri -csmParameterFileContent $csmParametersFileContent -sasTokenParameterName $sasTokenParameterName

Switch-AzureMode AzureResourceManager

$subscription = Get-SubscriptionInformation -subscriptionId $ConnectedServiceName

Write-Output "Creating resource group deployment $resourceGroupName"
$resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location

Initialize-DTLServiceHelper

Write-Output "Registering provider AzureResourceGroupManagerV2"
$provider = Create-Provider -providerName "AzureResourceGroupManagerV2" -providerType "Microsoft Azure Compute Resource Provider"

Write-Output "Registering provider data for subscription $ConnectedServiceName"
$providerData = Create-ProviderData -providerName $provider.Name -providerDataName $subscription.SubscriptionName -providerDataType $subscription.Environment -subscriptionId $subscription.SubscriptionId

$environmentDefinitionName = [System.String]::Format("{0}_{1}", $csmFileName, $env:BUILD_BUILDNUMBER)

Write-Output "Registering environment definition $environmentDefinitionName"
$environmentDefinition = Create-EnvironmentDefinition -environmentDefinitionName $environmentDefinitionName -providerName $provider.Name

$providerDataIds = New-Object System.Collections.Generic.List[string]
$providerDataIds.Add($providerData.Id)

$environmentResources = Get-Resources -resourceGroupName $resourceGroupName

Write-Output "Registering environment $resourceGroupName"
$environment = Create-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $resourceGroupDeployment.ProvisioningState -providerId $provider.ProviderId -providerDataIds $providerDataIds -environmentDefinitionId $environmentDefinition.Id -resources $environmentResources

Write-Output "Updating operation status and logs"
$environmentOperationId = Create-EnvironmentOperation -environment $environment

Write-Verbose -Verbose  "Leaving script DeployToAzureResourceGroup.ps1"
Write-Output "Leaving script DeployToAzureResourceGroup.ps1"