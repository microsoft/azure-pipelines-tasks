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

function Create-Provider
{
    param([string]$providerName,
              [string]$providerType)

    Write-Verbose "Registering provider $providerName" -Verbose

    $provider = Register-Provider -Name $providerName -Type $providerType -ErrorAction Stop

    Write-Verbose "Registered provider $provider" -Verbose

    return $provider
    }

function Create-ProviderData
{
    param([string]$providerName,
          [string]$providerDataName,
          [string]$providerDataType,
          [string]$subscriptionId)
              
    Write-Verbose "Registering provider data $providerDataName" -Verbose

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
    $subscriptionIdPropertyBagData = New-Object 'Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData' -ArgumentList $false, $subscriptionId
    $propertyBag.Add("SubscriptionId", $subscriptionIdPropertyBagData)

    #TODO Figure out authentication mechanism and store it
    $providerData = Register-ProviderData -Name $providerDataName -Type $providerDataType -ProviderName $providerName -PropertyBagValue $propertyBag -ErrorAction Stop

    Write-Verbose "Registered provider data $providerData" -Verbose

    return $providerData
}

function Create-EnvironmentDefinition
{
    param([string]$environmentDefinitionName,
          [string]$providerName)
  
    Write-Verbose "Registering environment definition $environmentDefinitionName" -Verbose

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
    $csmContent = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmFileContent)
    $propertyBag.Add("CsmContent", $csmContent)

    if ([string]::IsNullOrEmpty($csmParametersFile) -eq $false)
    {
        $csmParameters = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $csmParametersFileContent)
        $propertyBag.Add("CsmParameters", $csmParameters)
    }

    $environmentDefinition = Register-EnvironmentDefinition -Name $environmentDefinitionName -ProviderName $providerName -PropertyBagValue $propertyBag -ErrorAction Stop

    Write-Verbose "Registered environment definition $environmentDefinition" -Verbose

    return $environmentDefinition   
}

function Create-Environment
{
    param([string]$environmentName,
          [string]$environmentType,
          [string]$environmentStatus,
          [string]$providerId,
          [System.Collections.Generic.List[String]]$providerDataIds,
          [string]$environmentDefinitionId,
          [Microsoft.Azure.Commands.Resources.Models.PSResourceGroupDeployment]$azureResourceGroupDeployment,
          [System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]]$resources)

    Write-Verbose "Registering environment $environmentName" -Verbose

    $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
   
    foreach($key in $azureResourceGroupDeployment.Parameters.Keys)
    {
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $azureResourceGroupDeployment.Parameters.Item($key).Value)
        if($propertyBag.ContainsKey($key) -eq $false)
        {
            $propertyBag.Add($key, $property)
        }
    }

    foreach($tagKey in $azureResourceGroupDeployment.Tags.Keys)
    {
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $resource.Tags.Item($tagKey))
        $propertyBag.Add($tagKey, $property)
    }

    $environment = Register-Environment -Name $environmentName -Type $environmentType -Status $environmentStatus -ProviderId $providerId -ProviderDataIds $providerDataIds -EnvironmentDefinitionId $environmentDefinitionId -PropertyBagValue $propertyBag -Resources $resources -ErrorAction Stop

    Write-Verbose "Registered environment $environment" -Verbose
}

function Get-Resources
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose "Getting resources in $resourceGroupName" -Verbose

        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -Verbose -ErrorAction Stop

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
            
            foreach($tagKey in $resource.Tags.Keys)
            {
                $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $resource.Tags.Item($tagKey))
                $propertyBag.Add($tagKey, $property)
            }
            
            foreach($resourceProperty in $resource.Properties)
            {
                $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $resource.Properties.Item($resourceProperty.Key))
                $propertyBag.Add($resourceProperty.Key, $property)
            }

            $environmentResource.PropertyBag.AddProperties($propertyBag)

            $resources.Add($environmentResource)
            
        }
        
        Write-Verbose "Got resources: $resources" -Verbose

        return $resources
    }
}

function Create-AzureResourceGroup
{
    param([string]$csmFile, 
          [string]$csmParametersFile,
          [string]$resourceGroupName,
          [string]$location)
    
    $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -ErrorAction silentlycontinue
    
    if(!$azureResourceGroup)    
    {
        Write-Verbose -Verbose "Creating resource group $resourceGroupName in $location"

        $resourceGroup  = New-AzureResourceGroup -Name $resourceGroupName -Location $location -Verbose -ErrorAction Stop

        Write-Verbose -Verbose "Created resource group $resourceGroup"

        if ([string]::IsNullOrEmpty($csmParametersFile))
        {
            Write-Verbose -Verbose "New-AzureResourceGroupDeployment -Name $resourceGroupName
                                     -ResourceGroupName $resourceGroupName
                                     -TemplateFile $csmFile"
                                     
            $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -Verbose -ErrorAction Stop
        }
        else
        {
            Write-Verbose -Verbose "New-AzureResourceGroupDeployment -Name $resourceGroupName
                                     -ResourceGroupName $resourceGroupName
                                     -TemplateFile $csmFile
                                     -TemplateParameterFile $csmParametersFile"

            $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -TemplateParameterFile $csmParametersFile -Verbose -ErrorAction Stop
        }

        Write-Verbose -Verbose "Created resource group deployment with name $resourceGroupName"

        return $azureResourceGroupDeployment
    }
    else
    {
        $azureResourceGroupDeployment = Get-AzureResourceGroupDeployment -ResourceGroupName $resourceGroupName

        return $azureResourceGroupDeployment
   }
}

function Get-SubscriptionInformation
{
    param([string]$subscriptionId)

    if ([string]::IsNullOrEmpty($subscriptionId) -eq $false)
    {
        $subscription = Get-AzureSubscription -SubscriptionId $subscriptionId -Verbose -ErrorAction Stop
    }

    return $subscription
}

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

$environment = Create-Environment -environmentName $resourceGroupName -environmentType "Azure CSM V2" -environmentStatus $resourceGroupDeployment.ProvisioningState -providerId $provider.ProviderId -providerDataIds $providerDataIds -environmentDefinitionId $environmentDefinition.Id -azureResourceGroupDeployment $resourceGroupDeployment -resources $environmentResources

Write-Verbose -Verbose  "Leaving script DeployToAzureResourceGroup.ps1"