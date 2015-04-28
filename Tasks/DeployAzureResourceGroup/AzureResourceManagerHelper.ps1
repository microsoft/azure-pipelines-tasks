function Create-AzureResourceGroup
{
    param([string]$csmFile, 
          [System.Collections.Hashtable]$csmParametersObject,
          [string]$resourceGroupName,
          [string]$location)
    
    if([string]::IsNullOrEmpty($csmFile) -eq $false -and [string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($location) -eq $false)
    {
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
            $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -Verbose -ErrorAction Stop
        }
        else
        {
            $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -TemplateParameterObject $csmParametersObject -Verbose -ErrorAction Stop
        }

        Set-Variable -Name azureResourceGroupDeployment -Value $azureResourceGroupDeployment -Scope "Global"

        Write-Verbose -Verbose "Created resource group deployment with name $resourceGroupName"

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

function Get-Resources
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose "Getting resources in $resourceGroupName" -Verbose

        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -Verbose -ErrorAction Stop

        Set-Variable -Name azureResourceGroup -Value $azureResourceGroup -Scope "Global"

        $resources = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]'

        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName 

        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName 

        foreach ($resource in $azureResourceGroup.Resources)
        {
            $environmentResource = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2
            $environmentResource.Name = $resource.Name
            $environmentResource.Type = $resource.ResourceType

            if ($environmentResource.Type -eq "Microsoft.Compute/virtualMachines")
            {
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

                $fqdnTagKey = "Microsoft-Vslabs-MG-Resource-FQDN"
                
                $fqdnTagValue = Get-FQDN -ResourceGroupName $resourceGroupName -resourceName $resource.Name
                
                $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $fqdnTagValue)
                $propertyBag.Add($fqdnTagKey, $property)


                $environmentResource.Properties.AddOrUpdateProperties($propertyBag)

                $resources.Add($environmentResource)
            }
            
        }
        
        Write-Verbose "Got resources: $resources" -Verbose

        return $resources
    }
}

function Get-FQDN
{
    param([string]$resourceGroupName,
          [string]$resourceName)
    
    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($resourceName) -eq $false)
    {
        Write-Verbose "Getting FQDN for the resource $resourceName from resourceGroupName $resourceGroupName" -Verbose

        $azureVM = Get-AzureVM -ResourceGroupName $resourceGroupName -Name $resourceName
        
        foreach ($nic in $networkInterfaceResources)
        {
           if ($nic.Id -eq $azureVM.NetworkInterfaces)
           {
                $ipc = $nic.Properties.IpConfigurations
           }
        }

        if($ipc)
        {
            $publicIPAddr = $ipc[0].Properties.PublicIpAddress.Id

            foreach ($publicIP in $publicIPAddressResources) 
            {
                if($publicIP.id -eq $publicIPAddr)
                {
                    $fqdn = $publicIP.Properties.DnsSettings.Fqdn
                }
            }

            Write-Verbose "fqdn value for resource $resourceName is  $fqdn" -Verbose

            return $fqdn;
        }
    }

}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent)

    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false)
    {
        Write-Verbose "Generating the parameter object from the file $csmParameterFileContent" -Verbose

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)
        $parameters = $csmJObject.GetValue("parameters")
        $parametersObject  = $parameters.ToObject([System.Collections.Hashtable])

        $newParametersObject = New-Object 'System.Collections.Hashtable'

        foreach($key in $parametersObject.Keys)
        {
            $parameterValue = $parametersObject[$key] -as [Newtonsoft.Json.Linq.JObject]
            $newParametersObject.Add($key, $parameterValue["value"].ToString())
        }

        Write-Verbose "Generated the parameter object from the file $csmParameterFileContent" -Verbose

        return $newParametersObject
    }
}

function Refresh-SASToken
{
    param([string]$moduleUrlParameterName,
    [string]$sasTokenParameterName,
    [System.Collections.Hashtable]$csmParametersObject,
    [string]$subscriptionId,
    [string]$dscDeployment)

    if ($dscDeployment -eq "true")
    {
        if ($csmParametersObject.ContainsKey($sasTokenParameterName) -eq $false)
        {
            Throw "$sasTokenParameterName is not present in the csm parameter file. Specify correct parameter name"
        }

        if ($csmParametersObject.ContainsKey($moduleUrlParameterName) -eq $false)
        {
            Throw "$moduleUrlParameterName is not present in the csm parameter file. Specify correct parameter name"
        }

        $fullBlobUri = $csmParametersObject[$moduleUrlParameterName]
        $uri = $fullBlobUri -as [System.URI]
        if (($uri.AbsoluteURI -ne $null -And $uri.Scheme -match '[http|https]') -eq $false)
        {
            Throw "$moduleUrlParameterName $fullBlobUri is not in the correct url format"
        }

        Write-Verbose "Generating SAS token for $fullBlobUri" -Verbose

        $startTime = Get-Date

        $endTime = $startTime.AddHours(24.0)

        $fullBlobUri = $fullBlobUri.TrimEnd('/')

        $i = $fullBlobUri.LastIndexOf('/')
        if($i -ne -1)
        {
            $blobName = $fullBlobUri.Substring($i + 1)
            $fullBlobUri = $fullBlobUri.Remove($i)
        }

        $i = $fullBlobUri.LastIndexOf('/')
        if($i -ne -1)
        {
            $containerName = $fullBlobUri.Substring($i + 1)
            $fullBlobUri = $fullBlobUri.Remove($i)
        }

        $i = $fullBlobUri.IndexOf('.')
        if($i -ne -1)
        {
            $fullBlobUri = $fullBlobUri.Remove($i)
            $storageAccountName = $fullBlobUri.Substring($fullBlobUri.IndexOf("//") + 2)
        }

        Set-AzureSubscription -SubscriptionId $subscriptionId -CurrentStorageAccountName $storageAccountName

        $token  = New-AzureStorageBlobSASToken -Container $containerName -Blob $blobName -Permission r -StartTime $startTime -ExpiryTime $endTime -Verbose -ErrorAction Stop

        Write-Verbose "Generated SAS token for $fullBlobUri" -Verbose

        Write-Verbose "Replacing SAS token for parameter $sasTokenParameterName" -Verbose

        $csmParametersObject.Remove($sasTokenParameterName)
        $csmParametersObject.Add($sasTokenParameterName, $token)

        Write-Verbose "Replaced SAS token for parameter $sasTokenParameterName" -Verbose

    }

    return $csmParametersObject
}

