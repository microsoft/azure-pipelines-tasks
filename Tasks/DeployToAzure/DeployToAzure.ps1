param(
    [string]$ConnectedServiceName, 
    [string]$csmFile, 
    [string]$csmParametersFile,
    [string]$resourceGroupName,
    [string]$location,
	[string]$alternateCredentialsUsername,
	[string]$alternateCredentialsPassword
)

Write-Verbose -Verbose "Entering script DeployToAzure.ps1"
Write-Verbose -Verbose "resourceGroupName = $resourceGroupName"
Write-Verbose -Verbose "location = $location"
Write-Verbose -Verbose "csmFile = $csmFile"
Write-Verbose -Verbose "csmParametersFile = $csmParametersFile"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$env:DTL_ALTERNATE_CREDENTIALS_USERNAME = $alternateCredentialsUsername
$env:DTL_ALTERNATE_CREDENTIALS_PASSWORD = $alternateCredentialsPassword

function Register-Provider
{
    param([string]$providerName,
          [string]$providerType)

    if ([string]::IsNullOrEmpty($providerName) -eq $false -And [string]::IsNullOrEmpty($providerType) -eq $false)
    {
		Write-Verbose "Registering provider $providerName" -Verbose

		$provider = Register-Provider -Name $providerName -Type $providerType -PropertyBagValue $null

		Write-Verbose "Registered provider $provider" -Verbose

		return $provider
    }
}

function Register-ProviderData
{
	param([string]$providerDataName,
          [string]$providerDataType,
		  [string]$providerName)
    
    if ([string]::IsNullOrEmpty($providerDataName) -eq $false -And [string]::IsNullOrEmpty($providerDataType) -eq $false -And [string]::IsNullOrEmpty($providerName) -eq $false)
    {
		Write-Verbose "Registering provider data $providerDataName" -Verbose

		$propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
		$subscriptionNamePropertyBagData = New-Object 'Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData' -ArgumentList $false, $azureSubscriptionName
		$subscriptionIdPropertyBagData = New-Object 'New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData' -ArgumentList $false, $azureSubscriptionId
		$propertyBag.Add("SubscriptionName", $subscriptionNamePropertyBagData)
		$propertyBag.Add("SubscriptionId", $subscriptionIdPropertyBagData)

		$providerData = Register-ProviderData -Name $providerDataName -Type $providerDataType -ProviderName $providerName -PropertyBagValue $propertyBag

		Write-Verbose "Registered provider data $providerData" -Verbose

		return $providerData
    }
}

function Register-EnvironmentDefinition
{
	param([string]$environmentDefinitionName,
          [string]$providerId)

	if ([string]::IsNullOrEmpty($environmentDefinitionName) -eq $false -And [string]::IsNullOrEmpty($providerId) -eq $false)
	{
		Write-Verbose "Registering environment definition $environmentDefinitionName" -Verbose

		$propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
		$csmFileContent = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmFile)
		$csmParameters = New-Object New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmParametersFile)
		$propertyBag.Add("CsmContent", $csmFileContent)
		$propertyBag.Add("CsmParameters", $csmParameters)

		$environmentDefinition = Register-EnvironmentDefinition -Name $environmentDefinitionName -ProviderId $providerId -PropertyBagValue $propertyBag

		Write-Verbose "Registered environment definition $environmentDefinition" -Verbose

		return $environmentDefinition
	}
}

function Register-Environment
{
	param([string]$environmentName,
          [string]$environmentType,
		  [string]$environmentStatus,
		  [string]$providerId,
		  [System.Collections.Generic.List[String]]$providerDataIds,
		  [string]$environmentDefinitionId,
		  [System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]]$resources)

	if ([string]::IsNullOrEmpty($environmentName) -eq $false)
	{
		Write-Verbose "Registering environment $environmentName" -Verbose

		$propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
		$environmentLocation = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $location)
		$propertyBag.Add("Location", $environmentLocation)

		$environment = Register-Environment -Name $environmentName -Type $environmentType -Status $environmentStatus -ProviderId $providerId
		 -ProviderDataIds $providerDataIds -EnvironmentDefinitionId $environmentDefinitionId -PropertyBagValue $propertyBag -Resources $resources

		Write-Verbose "Registered environment $environment" -Verbose
	}
}

function Get-Resources
{
	param([string]$resourceGroupName)

	if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
	{
		Write-Verbose "Getting resources in $resourceGroupName" -Verbose

		$azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName

		$resources = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]'

		foreach ($resource in $azureResourceGroup.Resources)
		{
			$environmentResource = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2
			$environmentResource.Name = $resource.Name
			$environmentResource.Type = $resource.ResourceType

			$propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
			$resourceLocation = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $resource.Location)
			$platformId = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $resource.ResourceId)
			$propertyBag.Add("Location", $resourceLocation)
			$propertyBag.Add("PlatformId", $platformId)

			$resources.Add($environmentResource)
		}

		Write-Verbose "Got resources in $resources" -Verbose

		return $resources
	}
}

function Create-AzureResourceGroup
{
	param([string]$csmFile, 
		  [string]$csmParametersFile,
		  [string]$resourceGroupName,
		  [string]$location)
	
	$azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName
	
	if(!$azureResourceGroup)
	{
		Write-Verbose -Verbose "Creating resource group $resourceGroupName in $location"

		$resourceGroup  = New-AzureResourceGroup -Name $resourceGroupName -Location $location

		Write-Verbose -Verbose "Created resource group $resourceGroup"

		Write-Verbose -Verbose "New-AzureResourceGroupDeployment -Name $resourceGroupName
									 -ResourceGroupName $resourceGroupName
									 -TemplateFile $csmFile
									 -TemplateParameterFile $csmParametersFile"
		$azureResourceGroupDeployment = New-AzureResourceGroupDeployment -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -TemplateParameterFile $csmParametersFile

		Write-Verbose -Verbose "Created resource group deployment $azureResourceGroupDeployment"

		return $azureResourceGroupDeployment
	}
	else
	{
		Write-Error "Resource group already exists"
	}
}


Switch-AzureMode AzureResourceManager

$resourceGroupDeployment = Create-AzureResourceGroup -csmFile $csmFile -csmParametersFile $csmParametersFile -resourceGroupName $resourceGroupName -location $location
	
$provider = Register-Provider -providerName "Azure Resource Manager V2" -providerType "Azure Cloud Provider"

$providerData = Register-ProviderData -providerDataName "Subscription" -providerDataType "Azure" -providerName $provider.Name

$environmentDefinition = Register-EnvironmentDefinition -environmentDefinitionName "" -providerId $provider.Id

$resources = Get-Resources -resourceGroupName $resourceGroupName

$environment = Register-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $resourceGroupDeployment.ProvisioningState -providerId $provider.Id -environmentDefinitionId $environmentDefinition.Id -resources $resources

Write-Verbose -Verbose  "Leaving script DeployToAzure.ps1"
