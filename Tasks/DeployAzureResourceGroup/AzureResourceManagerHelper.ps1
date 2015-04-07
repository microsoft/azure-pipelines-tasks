function Create-AzureResourceGroup
{
    param([string]$csmFile, 
          [System.Collections.Hashtable]$csmParametersObject,
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

    if (!$csmParametersObject)
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

        $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -TemplateParameterObject $csmParametersObject -Verbose -ErrorAction Stop
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

function Replace-SASToken
{
    param([string]$csmParameterFileContent,
    [string]$sasTokenParameterName,
    [string]$newSASToken)

    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false -And [string]::IsNullOrEmpty($sasTokenParameterName) -eq $false -And [string]::IsNullOrEmpty($newSASToken) -eq $false)
    {
        Write-Verbose "Replacing the SAS token for parameter $sasTokenParameterName" -Verbose

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)
        $parameters = $csmJObject.GetValue("parameters")
        $parametersObject  = $parameters.ToObject([System.Collections.Hashtable])

        $newParametersObject = New-Object 'System.Collections.Hashtable'

        foreach($key in $parametersObject.Keys)
        {
            $parameterValue = $parametersObject[$key] -as [Newtonsoft.Json.Linq.JObject]
            $newParametersObject.Add($key, $parameterValue["value"].ToString())
        }

        $newParametersObject.Remove($sasTokenParameterName)
        $newParametersObject.Add($sasTokenParameterName, $newSASToken)

        Write-Verbose "Replaced the SAS token for parameter $sasTokenParameterName" -Verbose

        return $newParametersObject
    }
}

function Refresh-SASToken
{
    param([string]$fullBlobUri,
    [string]$csmParameterFileContent,
    [string]$sasTokenParameterName)

    if ([string]::IsNullOrEmpty($fullBlobUri) -eq $false)
    {
        Write-Verbose "Generating SAS token for $fullBlobUri" -Verbose

        $startTime = Get-Date

        $endTime = $startTime.AddHours(24.0)

        $fullBlobUri = $fullBlobUri.TrimEnd('/')

        $i = $fullBlobUri.LastIndexOf('/')
        $blobName = $fullBlobUri.Substring($i + 1)
        $fullBlobUri = $fullBlobUri.Remove($i)

        $i = $fullBlobUri.LastIndexOf('/')
        $containerName = $fullBlobUri.Substring($i + 1)
        $fullBlobUri = $fullBlobUri.Remove($i)

        $i = $fullBlobUri.IndexOf('.')
        $fullBlobUri = $fullBlobUri.Remove($i)
        $storageAccountName = $fullBlobUri.Substring($fullBlobUri.IndexOf("//") + 2)

        Set-AzureSubscription -SubscriptionId $ConnectedServiceName -CurrentStorageAccountName $storageAccountName

        $token  = New-AzureStorageBlobSASToken -Container $containerName -Blob $blobName -Permission r -StartTime $startTime -ExpiryTime $endTime -Verbose -ErrorAction Stop

        Write-Verbose "Generated SAS token for $fullBlobUri" -Verbose

        $csmParametersObject = Replace-SASToken -csmParameterFileContent $csmParameterFileContent -sasTokenParameterName $sasTokenParameterName -newSASToken $token

        return $csmParametersObject
    }
}

