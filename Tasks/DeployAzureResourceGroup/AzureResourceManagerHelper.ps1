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

        Get-MachineConnectionInformation -resourceGroupName $resourceGroupName

        $azureResourceGroupResources = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Compute/virtualMachines"}

        $resources = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2]'

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
             
            #Adding resource tags
            foreach($tagKey in $resource.Tags.Keys)
            {
                $tagValue = $resource.Tags.Item($tagKey)
                if([string]::IsNullOrEmpty($tagValue) -eq $false)
                {
                    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $tagValue)
                    $propertyBag.Add($tagKey, $property)
                }
            }

            #Adding resource platform properties
            foreach($resourcePropertyKey in $resource.Properties.Keys)
            {
                $propertyValue = $resource.Properties.Item($resourcePropertyKey)
                if([string]::IsNullOrEmpty($propertyValue) -eq $false)
                {
                    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $propertyValue)
                    $propertyBag.Add($resourcePropertyKey, $property)
                }
            }
            
            #Adding FQDN property
            if([string]::IsNullOrEmpty($fqdnMap[$resource.Name]) -eq $false)
            {
                $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $fqdnMap[$resource.Name])
                $propertyBag.Add("Microsoft-Vslabs-MG-Resource-FQDN", $property)
            }
        
            #Adding WinRMHttp port property
            if([string]::IsNullOrEmpty($winRmHttpPortMap[$resource.Name]) -eq $false)
            {
                $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $winRmHttpPortMap[$resource.Name])
                $propertyBag.Add("WinRM_Http", $property)
            }

            $environmentResource.Properties.AddOrUpdateProperties($propertyBag)

            $resources.Add($environmentResource)
        }
        
        Write-Verbose -Verbose "Got resources: $resources"

        return $resources
    }
}

function Get-MachineConnectionInformation
{
    param([string]$resourceGroupName)
    
    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        $azureVms = Get-AzureVm -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Set-Variable -Name azureVms -Value $azureVms -Scope "Global"
        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Set-Variable -Name networkInterfaceResources -Value $networkInterfaceResources -Scope "Global"
        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Set-Variable -Name publicIPAddressResources -Value $publicIPAddressResources -Scope "Global"

        $lb = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Network/loadBalancers"}

        if($lb)
        {
            $loadBalancer = Get-AzureLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
            Set-Variable -Name loadBalancer -Value $loadBalancer -Scope "Global"

            $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName
            $winRmHttpPortMap = Get-FrontEndPorts -BackEndPort "5985"
        }
        else
        {
            $fqdnMap = Get-MachinesFqdns -resourceGroupName $resourceGroupName
            $winRmHttpPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
        }

        Set-Variable -Name fqdnMap -Value $fqdnMap -Scope "Global"
        Set-Variable -Name winRmHttpPortMap -Value $winRmHttpPortMap -Scope "Global"
    }
}

function Get-FrontEndPorts
{
    param([string]$backEndPort)

    $portList = @{}

    if([string]::IsNullOrEmpty($backEndPort) -eq $false -and $networkInterfaceResources -and $loadBalancer -and $azureVms)
    {
        $rules = Get-AzureLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer
        $filteredRules = $rules | Where-Object {$_.BackendPort -eq $backEndPort}

        foreach($rule in $filteredRules)
        {
            $portList[$rule.BackendIPConfiguration.Id] = $rule.FrontendPort
        }

        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipConfig in $nic.IpConfigurations)
            {
                $frontEndPort = $portList[$ipConfig.Id]
                if([string]::IsNullOrEmpty($frontEndPort) -eq $false)
                {
                    $portList.Remove($ipConfig.Id)
                    $portList[$nic.VirtualMachine.Id] = $frontEndPort
                }
            }
        }

        $portError = 0
        foreach($vm in $azureVms)
        {
            $frontEndPort = $portList[$vm.Id]
            $resourceName = $vm.Name
            if([string]::IsNullOrEmpty($frontEndPort) -eq $false)
            {
                Write-Verbose "Front end port for resource $resourceName backend port $backEndPort is $frontEndPort" -Verbose
                $portList.Remove($vm.Id)
                $portList[$vm.Name] = $frontEndPort
            }
            else
            {
                $portError = $portError + 1
                Write-Verbose "Unable to find front end port for resource $resourceName backend port $backEndPort" -Verbose
            }
        }

        if($portError -eq $azureVMs.Count -and $azureVMs.Count -ne 0)
        {
            throw (Get-LocalizedString -Key "Unable to get front end ports for all resources in ResourceGroup : '{0}'" -ArgumentList $resourceGroupName)
        }
        else
        {
            if($portError -gt 0 -and $portError -ne $azureVMs.Count)
            {
                Write-Warning (Get-LocalizedString -Key "Unable to get front end ports for '{0}' resources in ResourceGroup : '{1}'" -ArgumentList $portError, $resourceGroupName)
            }
        }
    }
    
    return $portList
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName)

    $fqdnMap = @{}
    
    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVms)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource Group $resourceGroupName" -Verbose

        $frontEndIPConfigs = Get-AzureLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer

        foreach($publicIp in $publicIPAddressResources)
        {
            $fqdnMap[$publicIp.Id] =  $publicIP.DnsSettings.Fqdn
        }

        foreach($config in $frontEndIPConfigs)
        {
            $fqdn = $fqdnMap[$config.PublicIpAddress.Id]
            if([string]::IsNullOrEmpty($fqdn) -eq $false)
            {
                $fqdnMap.Remove($config.PublicIpAddress.Id)
                foreach($rule in $config.InboundNatRules)
                {
                    $fqdnMap[$rule.Id] =  $fqdn
                }
            }
        }

        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                foreach($rule in $ipc.LoadBalancerInboundNatRules)
                {
                    $fqdn = $fqdnMap[$rule.Id]
                    if([string]::IsNullOrEmpty($fqdn) -eq $false)
                    {
                        $fqdnMap.Remove($rule.Id)
                        $fqdnMap[$nic.VirtualMachine.Id] = $fqdn
                    }
                }
            }
        }

        $fqdnError = 0
        foreach($vm in $azureVms)
        {
            $fqdn = $fqdnMap[$vm.Id]
            $resourceName = $vm.Name

            if([string]::IsNullOrEmpty($fqdn) -eq $false)
            {
                Write-Verbose "FQDN value for resource $resourceName is $fqdn" -Verbose
                $fqdnMap.Remove($vm.Id)
                $fqdnMap[$resourceName] = $fqdn
            }
            else
            {
                $fqdnError = $fqdnError + 1
                Write-Verbose "Unable to find FQDN for resource $resourceName" -Verbose
            }
        }

        if($fqdnError -eq $azureVMs.Count -and $azureVMs.Count -ne 0)
        {
            throw (Get-LocalizedString -Key "Unable to get FQDN for all resources in ResourceGroup : '{0}'" -ArgumentList $resourceGroupName)
        }
        else
        {
            if($fqdnError -gt 0 -and $fqdnError -ne $azureVMs.Count)
            {
                Write-Warning (Get-LocalizedString -Key "Unable to get FQDN for '{0}' resources in ResourceGroup : '{1}'" -ArgumentList $fqdnError, $resourceGroupName)
            }
        }
    }

    return $fqdnMap
}

function Get-MachinesFqdns 
{
    param([string]$resourceGroupName)

    $fqdnMap = @{}
    
    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVms)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource Group $resourceGroupName" -Verbose

        foreach($publicIp in $publicIPAddressResources)
        {
            $fqdnMap[$publicIp.IpConfiguration.Id] =  $publicIP.DnsSettings.Fqdn
        }

        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                $fqdn =  $fqdnMap[$ipc.Id]
                if([string]::IsNullOrEmpty($fqdn) -eq $false)
                {
                    $fqdnMap.Remove($ipc.Id)
                    $fqdnMap[$nic.VirtualMachine.Id] = $fqdn
                }
            }
        }

        $fqdnError = 0
        foreach($vm in $azureVms)
        {
            $fqdn = $fqdnMap[$vm.Id]
            $resourceName = $vm.Name

            if([string]::IsNullOrEmpty($fqdn) -eq $false)
            {
                Write-Verbose "FQDN value for resource $resourceName is $fqdn" -Verbose
                $fqdnMap.Remove($vm.Id)
                $fqdnMap[$resourceName] = $fqdn
            }
            else
            {
                $fqdnError = $fqdnError + 1
                Write-Verbose "Unable to find FQDN for resource $resourceName" -Verbose
            }
        }

        if($fqdnError -eq $azureVMs.Count -and $azureVMs.Count -ne 0)
        {
            throw (Get-LocalizedString -Key "Unable to get FQDN for all resources in ResourceGroup : '{0}'" -ArgumentList $resourceGroupName)
        }
        else
        {
            if($fqdnError -gt 0 -and $fqdnError -ne $azureVMs.Count)
            {
                Write-Warning (Get-LocalizedString -Key "Unable to get FQDN for '{0}' resources in ResourceGroup : '{1}'" -ArgumentList $fqdnError, $resourceGroupName)
            }
        }
    
    }

    return $fqdnMap
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
