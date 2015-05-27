param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$location,
    [string][Parameter(Mandatory=$true)]$resourceGroupName,
    [string][Parameter(Mandatory=$true)]$csmFile,
    [string]$winrmListeners,
    [string]$csmParametersFile,
    [string]$overrideParameters,
    [string]$dscDeployment,
    [string]$moduleUrlParameterName,
    [string]$sasTokenParameterName,
    [string]$vmCreds,
    [string]$vmUserName,
    [string]$vmPassword,
    [string]$skipCACheck
)

. ./AzureResourceManagerHelper.ps1
. ./DtlServiceHelper.ps1
. ./Utility.ps1

$ErrorActionPreference = "Stop"

Write-Verbose "Starting Azure Resource Group Deployment Task" -Verbose

Write-Verbose -Verbose "SubscriptionId = $ConnectedServiceName"
Write-Verbose -Verbose "environmentName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "overrideParameters = $overrideParameters"
Write-Verbose -Verbose "moduleUrlParameterName = $moduleUrlParameterName"
Write-Verbose -Verbose "sasTokenParamterName = $sasTokenParameterName"
Write-Verbose -Verbose "WinRM Listeners = $winrmListeners"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

Validate-AzurePowershellVersion

$winrmListeners = "none"
#Find the matching deployment definition File
$csmFile = Get-File $csmFile
Write-Verbose -Verbose "deplyomentDefinitionFile = $csmFile"

# csmParametersFile value would be  BUILD_SOURCESDIRECTORY when left empty in UI.
if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY)
{
    #Find the matching deployment definition Parameter File
    $csmParametersFile = Get-File $csmParametersFile
    Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
}

Validate-DeploymentFileAndParameters -csmFile $csmFile -csmParametersFile $csmParametersFile

Validate-Credentials -vmCreds $vmCreds -vmUserName $vmUserName -vmPassword $vmPassword

$csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)
$csmFileContent = [System.IO.File]::ReadAllText($csmFile)

if(Test-Path -Path $csmParametersFile -PathType Leaf)
{
    $csmParametersFileContent = [System.IO.File]::ReadAllText($csmParametersFile)
}

Check-EnvironmentNameAvailability -environmentName $resourceGroupName

$parametersObject = Get-CsmParameterObject -csmParameterFileContent $csmParametersFileContent
$parametersObject = Refresh-SASToken -moduleUrlParameterName $moduleUrlParameterName -sasTokenParameterName $sasTokenParameterName -csmParametersObject $parametersObject -subscriptionId $ConnectedServiceName -dscDeployment $dscDeployment

Switch-AzureMode AzureResourceManager

if ($winrmListeners -eq "winrmhttps")
{
    if([string]::IsNullOrEmpty($azureKeyVaultName) -eq $true)
    {
        Write-Verbose -Verbose "AzureKeyVaultName not specified, generating a random vault name"
        $randomString = Get-RandomString
        $azureKeyVaultName = "vault-" + $randomString
    }

    Write-Verbose -Verbose "AzureKeyVaultName = $azureKeyVaultName"

    if([string]::IsNullOrEmpty($azureKeyVaultSecretName) -eq $true)
    {
        Write-Verbose -Verbose "AzureKeyVaultSecretName not specified, generating a random secret name"
        $randomString = Get-RandomString
        $azureKeyVaultSecretName = "secret-" + $randomString
    }

    Write-Verbose -Verbose "AzureKeyVaultSecretName = $azureKeyVaultSecretName"

    $azureKeyVaultSecretId = Upload-CertificateOnAzureKeyVaultAsSecret -certificatePath $certificatePath -certificatePassword $certificatePassword -resourceGroupName $resourceGroupName -location $location -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretName $azureKeyVaultSecretName
}

if($winrmListeners -ne "none")
{
    #Storing in temp variable so that we can cleanup Temp file later on
    $tempFile = Create-CSMForWinRMConfiguration -baseCsmFileContent $csmFileContent -winrmListeners $winrmListeners -resourceGroupName $resourceGroupName -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecretId

    if([string]::IsNullOrEmpty($tempFile) -eq $false)
    {
        $csmFile = $tempFile
    }
}

$subscription = Get-SubscriptionInformation -subscriptionId $ConnectedServiceName

$resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location -overrideParameters $overrideParameters

if([string]::IsNullOrEmpty($tempFile) -eq $false)
{
    Write-Verbose -Verbose "Removing temp file $tempFile"
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

Initialize-DTLServiceHelper

$provider = Create-Provider -providerName "AzureResourceGroupManagerV2" -providerType "Microsoft Azure Compute Resource Provider"

$providerData = Create-ProviderData -providerName $provider.Name -providerDataName $subscription.SubscriptionName -providerDataType $subscription.Environment -subscriptionId $subscription.SubscriptionId

$environmentDefinitionName = [System.String]::Format("{0}_{1}", $csmFileName, $env:BUILD_BUILDNUMBER)

$environmentDefinition = Create-EnvironmentDefinition -environmentDefinitionName $environmentDefinitionName -providerName $provider.Name

$providerDataNames = New-Object System.Collections.Generic.List[string]
$providerDataNames.Add($providerData.Name)

$environmentResources = Get-Resources -resourceGroupName $resourceGroupName

$environment = Create-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $resourceGroupDeployment.ProvisioningState -providerName $provider.Name -providerDataNames $providerDataNames -environmentDefinitionName $environmentDefinition.Name -resources $environmentResources

$environmentOperationId = Create-EnvironmentOperation -environment $environment

if($deploymentError)
{
    Throw (Get-LocalizedString -Key "Deploy Azure Resource Group Task failed. View logs for details")
}

Write-Verbose "Completing Azure Resource Group Deployment Task" -Verbose
