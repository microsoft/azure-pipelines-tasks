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

    }

    $startTime = Get-Date
    $startTime = $startTime.ToUniversalTime()
    Set-Variable -Name startTime -Value $startTime -Scope "Global"

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

    Set-Variable -Name azureResourceGroupDeployment -Value $azureResourceGroupDeployment -Scope "Global"

    Write-Verbose -Verbose "Created resource group deployment with name $resourceGroupName"

    return $azureResourceGroupDeployment
    
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

function Get-Resources
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose "Getting resources in $resourceGroupName" -Verbose

        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -Verbose -ErrorAction Stop

        Set-Variable -Name azureResourceGroup -Value $azureResourceGroup -Scope "Global"

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

            $environmentResource.PropertyBag.AddOrUpdateProperties($propertyBag)

            $resources.Add($environmentResource)
            
        }
        
        Write-Verbose "Got resources: $resources" -Verbose

        return $resources
    }
}

