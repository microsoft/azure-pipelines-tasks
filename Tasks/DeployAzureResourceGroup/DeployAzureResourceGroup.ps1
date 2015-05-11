param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName, 
    [string][Parameter(Mandatory=$true)]$location,
    [string][Parameter(Mandatory=$true)]$resourceGroupName,
    [string][Parameter(Mandatory=$true)]$csmFile, 
    [string]$csmParametersFile,
    [string]$dscDeployment,
    [string]$moduleUrlParameterName,
    [string]$sasTokenParameterName,
    [string]$vmCreds,
    [string]$vmUserName,
    [string]$vmPassword,
    [string]$configurePowerShellPorts,
    [string]$protocol,
    [string]$certificatePath,
    [string]$certificatePassword,
    [string]$azureKeyVaultName,
    [string]$azureKeyVaultSecretName
)

. ./AzureResourceManagerHelper.ps1
. ./DtlServiceHelper.ps1
. ./Utility.ps1

$ErrorActionPreference = "Stop"

Write-Host "******************************************************************************"
Write-Host "Starting Azure Resource Group Deployment Task"

Write-Verbose -Verbose "SubscriptionId = $ConnectedServiceName"
Write-Verbose -Verbose "environmentName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "moduleUrlParameterName = $moduleUrlParameterName"
Write-Verbose -Verbose "sasTokenParamterName = $sasTokenParameterName"
Write-Verbose -Verbose "configurePowerShellPorts = $configurePowerShellPorts"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

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

if ($configurePowerShellPorts -eq "true")
{
    #Find the matching certificate File
    $certificatePath = Get-File $certificatePath
    Write-Verbose -Verbose "CertificatePath = $certificatePath"

    Validate-AzureKeyVaultSecret -certificatePath $certificatePath -certificatePassword $certificatePassword

    if([string]::IsNullOrEmpty($azureKeyVaultName) -eq $true)
    {
        $randomString = Get-RandomString
        $azureKeyVaultName = "vlt-" + $randomString
    }
    
    Write-Verbose -Verbose "AzureKeyVaultName = $azureKeyVaultName"

    if([string]::IsNullOrEmpty($azureKeyVaultSecretName) -eq $true)
    {
        $randomString = Get-RandomString
        $azureKeyVaultSecretName = "sec-" + $randomString
    }

    Write-Verbose -Verbose "AzureKeyVaultSecretName = $azureKeyVaultSecretName"

    Create-ResourceGroup -resourceGroupName $resourceGroupName -location $location

    Create-AzureKeyVault -azureKeyVaultName $azureKeyVaultName -ResourceGroupName $resourceGroupName -Location $location

    $secretValue = Get-SecretValueForAzureKeyVault -certificatePath $certificatePath -certificatePassword $certificatePassword

    $azureKeyVaultSecret = Create-AzureKeyVaultSecret -azureKeyVaultName $azureKeyVaultName -secretName $azureKeyVaultSecretName -secretValue $secretValue

    #Storing in temp variable so that we can cleanup Temp File only later on
    $tempFile = Create-CSMForWinRMConfiguration -baseCsmFileContent $csmFileContent -protocol $protocol -resourceGroupName $resourceGroupName -azureKeyVaultName $azureKeyVaultName -azureKeyVaultSecretId $azureKeyVaultSecret.Id

    $csmFile = $tempFile
}

$subscription = Get-SubscriptionInformation -subscriptionId $ConnectedServiceName

$resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersObject $parametersObject -resourceGroupName $resourceGroupName -location $location

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
    Throw "Deploy Azure Resource Group Task failed. View logs for details"
}

Write-Host "Completing Azure Resource Group Deployment Task"
Write-Host "******************************************************************************"
