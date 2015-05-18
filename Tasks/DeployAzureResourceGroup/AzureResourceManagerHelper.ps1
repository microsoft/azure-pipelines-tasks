function Create-AzureResourceGroup
{
    param([string]$csmFile, 
          [System.Collections.Hashtable]$csmParametersObject,
          [string]$resourceGroupName,
          [string]$location,
          [string]$overrideParameters)
    
    if([string]::IsNullOrEmpty($csmFile) -eq $false -and [string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($location) -eq $false)
    {
        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -ErrorAction silentlycontinue
    
        if(!$azureResourceGroup)    
        {
            Write-Verbose -Verbose "Creating resource group $resourceGroupName in $location"

            $resourceGroup  = New-AzureResourceGroup -Name $resourceGroupName -Location $location -Verbose -ErrorAction Stop

            Write-Host (Get-LocalizedString -Key "Created resource group '{0}'" -ArgumentList $resourceGroup)

        }

        $startTime = Get-Date
        Set-Variable -Name startTime -Value $startTime -Scope "Global"

        Write-Verbose -Verbose "Creating resource group deployment with name $resourceGroupName"

        if (!$csmParametersObject)
        {
            $azureCommand = "New-AzureResourceGroupDeployment"
            $azureCommandArguments = "-Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
            $finalCommand = "`$azureResourceGroupDeployment = $azureCommand $azureCommandArguments"
            Write-Host "$finalCommand"
            Invoke-Expression -Command $finalCommand
        }
        else
        {
            $azureCommand = "New-AzureResourceGroupDeployment"
            $azureCommandArguments = "-Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" -TemplateParameterObject `$csmParametersObject $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
            $finalCommand = "`$azureResourceGroupDeployment = $azureCommand $azureCommandArguments"
            Write-Host "$finalCommand"
            Invoke-Expression -Command $finalCommand
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

                Write-Host (Get-LocalizedString -Key "Resource group deployment '{0}' failed" -ArgumentList $resourceGroupName)
            }
            else
            {
                Write-Host (Get-LocalizedString -Key "Successfully created resource group deployment with name '{0}'" -ArgumentList $resourceGroupName)
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
            throw (Get-LocalizedString -Key "Unable to get FQDN for all resources in ResourceGroup : '{0}'" -ArgumentList $resourceGroupName)
        }
        else
        {
            if($fqdnErrorCount -gt 0 -and $fqdnErrorCount -ne $azureResourceGroupResources.Count)
            {
                Write-Warning (Get-LocalizedString -Key "Unable to get FQDN for '{0}' resources in ResourceGroup : '{1}'" -ArgumentList $fqdnErrorCount, $resourceGroupName)
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
                Write-Host (Get-LocalizedString -Key "Unable to find IPConfiguration of resource '{0}'" -ArgumentList $resourceName)
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
            throw (Get-LocalizedString -Key "'{0}' is not present in the csm parameter file. Specify correct parameter name" -ArgumentList $sasTokenParameterName)
        }

        if ($csmParametersObject.ContainsKey($moduleUrlParameterName) -eq $false)
        {
            throw (Get-LocalizedString -Key "'{0}' is not present in the csm parameter file. Specify correct parameter name" -ArgumentList $moduleUrlParameterName)
        }

        $fullBlobUri = $csmParametersObject[$moduleUrlParameterName]
        $uri = $fullBlobUri -as [System.URI]
        if (($uri.AbsoluteURI -ne $null -And $uri.Scheme -match '[http|https]') -eq $false)
        {
            throw (Get-LocalizedString -Key "'{0}' '{1}' is not in the correct url format" -ArgumentList $moduleUrlParameterName, $fullBlobUri)
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

        Write-Host (Get-LocalizedString -Key "Generated SAS token for '{0}'" -ArgumentList $uri)

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

function Get-ServiceEndPointDetails
{
    param([String][Parameter(Mandatory = $true)]$ConnectedServiceName)

    Write-Verbose "Entering in Get-ServiceEndPointDetails" -Verbose

    $serviceEndpoint = Get-ServiceEndpoint -Name $ConnectedServiceName -Context $distributedTaskContext

    if ($serviceEndpoint -eq $null)
    {
        throw (Get-LocalizedString -Key "A Connected Service with name '{0}' could not be found. Ensure that this Connected Service was successfully provisioned using services tab in Admin UI" -ArgumentList $ConnectedServiceName)
    }

    if ($serviceEndpoint.Authorization.Scheme -eq 'UserNamePassword')
    {
        $username = $serviceEndpoint.Authorization.Parameters.UserName
        $password = $serviceEndpoint.Authorization.Parameters.Password
        Write-Verbose "Username= $username" -Verbose

        $azureSubscriptionId = $serviceEndpoint.Data.SubscriptionId
        $azureSubscriptionName = $serviceEndpoint.Data.SubscriptionName
        Write-Verbose "azureSubscriptionId= $azureSubscriptionId" -Verbose
        Write-Verbose "azureSubscriptionName= $azureSubscriptionName" -Verbose

        $propertyBag = New-Object 'System.Collections.Generic.Dictionary[string, Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData]'
        
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $azureSubscriptionName)
        $propertyBag.Add("SubscriptionName", $property)
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $azureSubscriptionId)
        $propertyBag.Add("SubscriptionId", $property)
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $username)
        $propertyBag.Add("Username", $property)
        $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($true, $password)
        $propertyBag.Add("Password", $property)

        Write-Verbose "Completed Get-ServiceEndPointDetails" -Verbose

        return $propertyBag
    }
    else
    {
        throw (Get-LocalizedString -Key "Unsupported authorization scheme for azure endpoint = '{0}'" -ArgumentList $serviceEndpoint.Authorization.Scheme)
    }
}
