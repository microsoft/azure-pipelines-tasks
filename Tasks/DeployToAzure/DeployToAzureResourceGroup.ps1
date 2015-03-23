param(
    [string]$ConnectedServiceName, 
    [string]$location,
    [string]$resourceGroupName,
    [string]$csmFile, 
    [string]$csmParametersFile,
    [string]$alternateCredentialsUsername,
    [string]$alternateCredentialsPassword
)

Write-Verbose -Verbose "Entering script DeployToAzureResourceGroup.ps1"
Write-Verbose -Verbose "environmentName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "deplyomentDefinitionFile = $csmFile"
Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs

$env:DTL_ALTERNATE_CREDENTIALS_USERNAME = $alternateCredentialsUsername
$env:DTL_ALTERNATE_CREDENTIALS_PASSWORD = $alternateCredentialsPassword

$csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)
$csmFileComtent = [System.IO.File]::ReadAllText($csmFile)
$csmParametersFileContent = [System.IO.File]::ReadAllText($csmParametersFile)

. ./AzureResourceManagerHelper.ps1
. ./DtlServiceHelper.ps1

Switch-AzureMode AzureResourceManager

$subscription = Get-SubscriptionInformation -subscriptionId $ConnectedServiceName

$resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersFile $csmParametersFile -resourceGroupName $resourceGroupName -location $location

$provider = Create-Provider -providerName "AzureResourceGroupManagerV2" -providerType "Microsoft Azure Compute Resource Provider"

$providerData = Create-ProviderData -providerName $provider.Name -providerDataName $subscription.SubscriptionName -providerDataType $subscription.Environment -subscriptionId $subscription.SubscriptionId

$environmentDefinitionName = [System.String]::Format("{0}_{1}", $csmFileName, $env:BUILD_BUILDNUMBER)

$environmentDefinition = Create-EnvironmentDefinition -environmentDefinitionName $environmentDefinitionName -providerName $provider.Name

$providerDataIds = New-Object System.Collections.Generic.List[string]
$providerDataIds.Add($providerData.Id)

$environmentResources = Get-Resources -resourceGroupName $resourceGroupName

$environment = Create-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $resourceGroupDeployment.ProvisioningState -providerId $provider.ProviderId -providerDataIds $providerDataIds -environmentDefinitionId $environmentDefinition.Id -resources $environmentResources

$environmentOperationId = Create-EnvironmentOperation -environment $environment

Write-Verbose -Verbose  "Leaving script DeployToAzureResourceGroup.ps1"
