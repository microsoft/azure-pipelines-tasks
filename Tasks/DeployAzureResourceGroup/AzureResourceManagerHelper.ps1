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

            Write-Host "Created resource group $resourceGroup"

        }

        $startTime = Get-Date
        #$startTime = $startTime.ToUniversalTime()
        Set-Variable -Name startTime -Value $startTime -Scope "Global"

        Write-Verbose -Verbose "Creating resource group deployment with name $resourceGroupName"

        if (!$csmParametersObject)
        {
            $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError
        }
        else
        {
            $azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name $resourceGroupName -ResourceGroupName $resourceGroupName -TemplateFile $csmFile -TemplateParameterObject $csmParametersObject -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError
        }

        if ($azureResourceGroupDeployment)
        {
            Set-Variable -Name azureResourceGroupDeployment -Value $azureResourceGroupDeployment -Scope "Global"

            Get-MachineLogs -ResourceGroupName $resourceGroupName

            if($deploymentError)
            {
                Set-Variable -Name deploymentError -Value $deploymentError -Scope "Global"

                foreach($error in $deploymentError)
                {
                    Write-Verbose -Verbose $error
                }

                Write-Host "Resource group deployment $resourceGroupName failed"
            }
            else
            {
                Write-Host "Successfully created resource group deployment with name $resourceGroupName"
            }

            return $azureResourceGroupDeployment
        }
        else
        {
            Throw $deploymentError
        }
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
        Write-Verbose -Verbose "Getting resources in $resourceGroupName"

        $azureResourceGroupResources = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Compute/virtualMachines"}

        $resources = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]'

        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName 

        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName 

        $fqdnErrorCount = 0

        foreach ($resource in $azureResourceGroupResources)
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
                $tagValue = $resource.Tags.Item($tagKey)
                if([string]::IsNullOrEmpty($tagValue) -eq $false)
                {
                    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $tagValue)
                    $propertyBag.Add($tagKey, $property)
                }
            }

            foreach($resourcePropertyKey in $resource.Properties.Keys)
            {
                $propertyValue = $resource.Properties.Item($resourcePropertyKey)
                if([string]::IsNullOrEmpty($propertyValue) -eq $false)
                {
                    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $propertyValue)
                    $propertyBag.Add($resourcePropertyKey, $property)
                }
            }
            
            # getting fqdn value for vm resource
            $fqdnTagValue = Get-FQDN -ResourceGroupName $resourceGroupName -resourceName $resource.Name

            if([string]::IsNullOrEmpty($fqdnTagValue) -eq $false)
            {          
                $fqdnTagKey = "Microsoft-Vslabs-MG-Resource-FQDN"
                $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $fqdnTagValue)
                $propertyBag.Add($fqdnTagKey, $property)
            }
            else
            {
                $fqdnErrorCount = $fqdnErrorCount + 1
            }
        
            $environmentResource.Properties.AddOrUpdateProperties($propertyBag)

            $resources.Add($environmentResource)
        }
        
        if($fqdnErrorCount -eq $azureResourceGroupResources.Count -and $azureResourceGroupResources.Count -ne 0)
        {
            throw "Unable to get FQDN for all resources in ResourceGroup : $resourceGroupName"
        }
        else
        {
            if($fqdnErrorCount -gt 0 -and $fqdnErrorCount -ne $azureResourceGroupResources.Count)
            {
                 Write-Warning "Unable to get FQDN for $fqdnErrorCount resources in ResourceGroup : $resourceGroupName" -Verbose
            }
        }
    
        Write-Verbose -Verbose "Got resources: $resources"

        return $resources
    }
}

function Get-FQDN
{
    param([string]$resourceGroupName,
          [string]$resourceName)
    
    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($resourceName) -eq $false)
    {
        Write-Verbose "Trying to get FQDN for the resource $resourceName from resource Group $resourceGroupName" -Verbose

        $azureVM = Get-AzureVM -ResourceGroupName $resourceGroupName -Name $resourceName -ErrorAction silentlycontinue -ErrorVariable fqdnError

        if(!$azureVM)
        {
            Write-Host $fqdnError -Verbose
        }
        else
        {
            foreach ($networkInterface in $azureVM.NetworkProfile.NetworkInterfaces)
            {
                $nic = $networkInterfaceResources | Where-Object {$_.Id -eq $networkInterface.ReferenceUri}
                if($nic)
                {
                     $ipc = $nic.IpConfigurations
                    break
                }
            }
            if($ipc)
            {
                $publicIPAddr = $ipc.PublicIpAddress.Id
            
                foreach ($publicIP in $publicIPAddressResources) 
                {
                    if($publicIP.id -eq $publicIPAddr)
                    {
                        $fqdn = $publicIP.DnsSettings.Fqdn
                        break
                    }
                }

                if($fqdn -eq $null)
                {
                    Write-Verbose "Unable to find FQDN for resource $resourceName" -Verbose
                }
                else
                {
                    Write-Verbose "FQDN value for resource $resourceName is $fqdn" -Verbose
               
                    return $fqdn;
                }

            }
            else
            {
                Write-Host "Unable to find IPConfiguration of resource $resourceName" -Verbose
            }
        }
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

        Write-Verbose -Verbose "Generating SAS token for $fullBlobUri"

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

        Write-Host "Generated SAS token for $uri"

        Write-Verbose -Verbose "Replacing SAS token for parameter $sasTokenParameterName"

        $csmParametersObject.Remove($sasTokenParameterName)
        $csmParametersObject.Add($sasTokenParameterName, $token)

        Write-Verbose -Verbose "Replaced SAS token for parameter $sasTokenParameterName"
    }

    return $csmParametersObject
}

function Get-MachineLogs
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -Verbose -ErrorAction Stop

        Set-Variable -Name azureResourceGroup -Value $azureResourceGroup -Scope "Global"
        
        $azureResourceGroupResources = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Compute/virtualMachines"}

        foreach($resource in $azureResourceGroupResources)
        {
            $name = $resource.Name
            $vmInstanceView = Get-AzureVM -Name $resource.Name -ResourceGroupName $resourceGroupName -Status -Verbose -ErrorAction Stop

            Write-Verbose -Verbose "Machine $name status:"
            foreach($status in $vmInstanceView.Statuses)
            {
                Print-OperationLog -Log $status
            }

            if($vmInstanceView.VMAgent.ExtensionHandlers)
            {
                Write-Verbose -Verbose "Machine $name VM agent status:"
                foreach($extensionHandler in $vmInstanceView.VMAgent.ExtensionHandlers)
                {
                    Print-OperationLog -Log $extensionHandler.Status
                }
            }

            foreach($extension in $vmInstanceView.Extensions)
            {
                $extensionName = $extension.Name

                Write-Verbose -Verbose "Extension $extensionName status:"
                foreach($status in $extension.Statuses)
                {
                    Print-OperationLog -Log $status
                }

                Write-Verbose -Verbose "Extension $extensionName sub status:"
                foreach($status in $extension.SubStatuses)
                {
                    Print-OperationLog -Log $status
                }
            }
        }

        Write-Verbose -Verbose "End of machine group deployment logs"
    }
}

function Print-OperationLog
{
    param([System.Object]$log)

    if($log)
    {
        $status = $log.DisplayStatus
        if([string]::IsNullOrEmpty($status) -eq $false)
        {
            Write-Verbose -Verbose "Status: $status"
        }

        $message = $log.Message
        if([string]::IsNullOrEmpty($message) -eq $false)
        {
            Write-Verbose -Verbose "Message: $message"
        }
    }
}

