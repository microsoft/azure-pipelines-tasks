function Create-AzureResourceGroup
{
    param([string]$csmFile, 
          [System.Collections.Hashtable]$csmParametersObject,
          [string]$resourceGroupName,
          [string]$location,
          [string]$overrideParameters)
    
    if([string]::IsNullOrEmpty($csmFile) -eq $false -and [string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($location) -eq $false)
    {
        Create-AzureResourceGroupIfNotExist -resourceGroupName $resourceGroupName -location $location
        $startTime = Get-Date
        Set-Variable -Name startTime -Value $startTime -Scope "Global"

        if (!$csmParametersObject)
        {
            $azureCommand = "New-AzureResourceGroupDeployment"
            $azureCommandArguments = "-Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
            $finalCommand = "`$azureResourceGroupDeployment = $azureCommand $azureCommandArguments"
            Write-Verbose -Verbose "$finalCommand"
            Write-Host "[Azure Resource Manager]Creating resource group deployment with name $resourceGroupName"
            Invoke-Expression -Command $finalCommand
        }
        else
        {
            $azureCommand = "New-AzureResourceGroupDeployment"
            $azureCommandArguments = "-Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" -TemplateParameterObject `$csmParametersObject $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
            $finalCommand = "`$azureResourceGroupDeployment = $azureCommand $azureCommandArguments"
            Write-Verbose -Verbose "$finalCommand"
            Write-Host "[Azure Resource Manager]Creating resource group deployment with name $resourceGroupName"
            Invoke-Expression -Command $finalCommand
        }

        if ($azureResourceGroupDeployment)
        {
            Write-Verbose -Verbose "[Azure Resource Manager]Created resource group deployment with name $resourceGroupName"
            Set-Variable -Name azureResourceGroupDeployment -Value $azureResourceGroupDeployment -Scope "Global"
            Get-MachineLogs -ResourceGroupName $resourceGroupName

            if($deploymentError)
            {
                Set-Variable -Name deploymentError -Value $deploymentError -Scope "Global"

                foreach($error in $deploymentError)
                {
                    Write-Error $error -ErrorAction Continue
                }

                Write-Error (Get-LocalizedString -Key "Resource group deployment '{0}' failed" -ArgumentList $resourceGroupName) -ErrorAction Continue
            }
            else
            {
                Write-Host (Get-LocalizedString -Key "Successfully created resource group deployment with name '{0}'" -ArgumentList $resourceGroupName)
            }

            Write-Verbose -Verbose "End of resource group deployment logs"

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

        if($azureResourceGroupResources)
        {
            Get-MachineConnectionInformation -resourceGroupName $resourceGroupName

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
                foreach($tag in $resource.Tags)
                {
                    $tagKey = $tag.Name
                    $tagValue = $tag.Value
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

                #Adding WinRMHttps port property
                if([string]::IsNullOrEmpty($winRmHttpsPortMap[$resource.Name]) -eq $false)
                {
                    $property = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.PropertyBagData($false, $winRmHttpsPortMap[$resource.Name])
                    $propertyBag.Add("WinRM_Https", $property)
                }

                $environmentResource.Properties.AddOrUpdateProperties($propertyBag)

                $resources.Add($environmentResource)
            }
        
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
        Write-Verbose -Verbose "[Azure Resource Manager]Getting machines in resource group $resourceGroupName"
        $azureVms = Get-AzureVm -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Resource Manager]Got machines in the resource group $resourceGroupName"
        Set-Variable -Name azureVms -Value $azureVms -Scope "Global"

        Write-Verbose -Verbose "[Azure Resource Manager]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Resource Manager]Got network interfaces in resource group $resourceGroupName"
        Set-Variable -Name networkInterfaceResources -Value $networkInterfaceResources -Scope "Global"

        Write-Verbose -Verbose "[Azure Resource Manager]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Resource Manager]Got public IP Addresses in resource group $resourceGroupName"
        Set-Variable -Name publicIPAddressResources -Value $publicIPAddressResources -Scope "Global"

        $lbGroup = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Network/loadBalancers"}

        $fqdnMap = @{}
        Set-Variable -Name fqdnMap -Value $fqdnMap -Scope "Global"
        
        $winRmHttpPortMap = @{}
        Set-Variable -Name winRmHttpPortMap -Value $winRmHttpPortMap -Scope "Global"

        $winRmHttpsPortMap = @{}
        Set-Variable -Name winRmHttpsPortMap -Value $winRmHttpsPortMap -Scope "Global"
        
        if($lbGroup.Count -gt 0)
        {
            foreach($lb in $lbGroup)
            {
                Write-Verbose -Verbose "[Azure Resource Manager]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
                Write-Verbose -Verbose "[Azure Resource Manager]Got load balancer in resource group $resourceGroupName"
                Set-Variable -Name loadBalancer -Value $loadBalancer -Scope "Global"

                $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName
                $winRmHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRmHttpsPortMap
                if($winRmHttpsPortMap.Count -ne 0)
                {
                    Set-Variable -Name WinRmProtocol -Value "HTTPS" -Scope "Global"
                }
                else
                {
                    $winRmHttpPortMap = Get-FrontEndPorts -BackEndPort "5985" -PortList $winRmHttpPortMap
                    if($winRmHttpPortMap.Count -ne 0)
                    {
                        Set-Variable -Name WinRmProtocol -Value "HTTP" -Scope "Global"
                    }
                }
            }

            $fqdnMap = GetMachineNameFromId -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
            if($WinRmProtocol -eq "HTTP")
            {
                $winRmHttpPortMap = GetMachineNameFromId -Map $winRmHttpPortMap -MapParameter "Front End port" -ThrowOnTotalUnavaialbility $false
            }
            if($WinRmProtocol -eq "HTTPS")
            {
                $winRmHttpsPortMap = GetMachineNameFromId -Map $winRmHttpsPortMap -MapParameter "Front End port" -ThrowOnTotalUnavaialbility $false
            }
        }
        else
        {
            $fqdnMap = Get-MachinesFqdns -resourceGroupName $resourceGroupName
            $winRmHttpPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
            $winRmHttpsPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
        }

    }
}

function Get-FrontEndPorts
{
    param([string]$backEndPort,
           [System.Collections.Hashtable]$portList)

    if([string]::IsNullOrEmpty($backEndPort) -eq $false -and $networkInterfaceResources -and $loadBalancer -and $azureVms)
    {
        Write-Verbose "Trying to get front end ports for $backEndPort" -Verbose

        $rules = Get-AzureLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer
        $filteredRules = $rules | Where-Object {$_.BackendPort -eq $backEndPort}

        #Map front end port to back end ipc
        foreach($rule in $filteredRules)
        {
            if($rule.BackendIPConfiguration)
            {
                $portList[$rule.BackendIPConfiguration.Id] = $rule.FrontendPort
            }
        }

        #Get the nic, and the corresponding machine id for a given back end ipc
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipConfig in $nic.IpConfigurations)
            {
                $frontEndPort = $portList[$ipConfig.Id]
                if([string]::IsNullOrEmpty($frontEndPort) -eq $false)
                {
                    $portList.Remove($ipConfig.Id)
                    if($nic.VirtualMachine)
                    {
                        $portList[$nic.VirtualMachine.Id] = $frontEndPort
                    }
                }
            }
        }

    }
    
    Write-Verbose "Got front end ports for $backEndPort" -Verbose

    return $portList
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName)

    
    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVms)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource Group $resourceGroupName" -Verbose

        $frontEndIPConfigs = Get-AzureLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer

        #Map the public ip id to the fqdn
        foreach($publicIp in $publicIPAddressResources)
        {
            if([string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn) -eq $false)
            {
            $fqdnMap[$publicIp.Id] =  $publicIP.DnsSettings.Fqdn
        }
            else
            {
                $fqdnMap[$publicIp.Id] =  $publicIP.IpAddress
            }
        }

        #Get the NAT rule for a given ip id
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

        #Find out the NIC, and thus the corresponding machine to which the HAT rule belongs
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
                        if($nic.VirtualMachine)
                        {
                            $fqdnMap[$nic.VirtualMachine.Id] = $fqdn
                        }
                    }
                }
            }
        }

    }

    Write-Verbose "Got FQDN for the resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-MachinesFqdns 
{
    param([string]$resourceGroupName)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVms)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource Group $resourceGroupName" -Verbose

        #Map the ipc to the fqdn
        foreach($publicIp in $publicIPAddressResources)
        {
            if([string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn) -eq $false)
            {
            $fqdnMap[$publicIp.IpConfiguration.Id] =  $publicIP.DnsSettings.Fqdn
        }
            else
            {
                $fqdnMap[$publicIp.IpConfiguration.Id] =  $publicIP.IpAddress
            }
        }

        #Find out the NIC, and thus the VM corresponding to a given ipc
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                $fqdn =  $fqdnMap[$ipc.Id]
                if([string]::IsNullOrEmpty($fqdn) -eq $false)
                {
                    $fqdnMap.Remove($ipc.Id)
                    if($nic.VirtualMachine)
                    {
                        $fqdnMap[$nic.VirtualMachine.Id] = $fqdn
                    }
                }
            }
        }

        $fqdnMap = GetMachineNameFromId -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
    
    }

    Write-Verbose "Got FQDN for the resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function GetMachineNameFromId
{
    param([System.Collections.Hashtable]$map,
          [string]$mapParameter,
          [boolean]$throwOnTotalUnavaialbility)
    
    if($map)
    {	
        $errorCount = 0
        foreach($vm in $azureVms)
        {
            $value = $map[$vm.Id]
            $resourceName = $vm.Name

            if([string]::IsNullOrEmpty($value) -eq $false)
            {
                Write-Verbose "$mapParameter value for resource $resourceName is $value" -Verbose
                $map.Remove($vm.Id)
                $map[$resourceName] = $value
            }
            else
            {
                $errorCount = $errorCount + 1
                Write-Verbose "Unable to find $mapParameter for resource $resourceName" -Verbose
            }
        }
        
        if($throwOnTotalUnavaialbility -eq $true)
        {
            if($errorCount -eq $azureVMs.Count -and $azureVMs.Count -ne 0)
            {
                throw (Get-LocalizedString -Key "Unable to get {0} for all resources in ResourceGroup : '{1}'" -ArgumentList $mapParameter, $resourceGroupName)
            }
            else
            {
                if($errorCount -gt 0 -and $errorCount -ne $azureVMs.Count)
                {
                    Write-Warning (Get-LocalizedString -Key "Unable to get {0} for '{1}' resources in ResourceGroup : '{2}'" -ArgumentList $mapParameter, $errorCount, $resourceGroupName)
                }
            }
        }

        return $map
    }
}

function Refresh-SASToken
{
    param([string]$moduleUrlParameterNames,
    [string]$sasTokenParameterNames,
    [System.Collections.Hashtable]$csmParametersObject,
    [string]$subscriptionId,
    [string]$dscDeployment)

    if ($dscDeployment -eq "true")
    {
        if([string]::IsNullOrEmpty($moduleUrlParameterNames) -eq $true)
        {
            Write-Warning (Get-LocalizedString -Key "Parameter name for the modules url is not specified. Cannot generate SAS token. Refer the csm parameters file for the parameter name")
            return $csmParametersObject
        }

        if([string]::IsNullOrEmpty($sasTokenParameterNames) -eq $true)
        {
            Write-Warning (Get-LocalizedString -Key "Parameter name for the SAS token is not specified. Cannot generate SAS token. Refer the csm parameters file for the parameter name")
            return $csmParametersObject
        }

        $sasTokenParameterNameList = New-Object System.Collections.Generic.List[string]
        $sasTokenParameterNames.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)  | Foreach-Object { if([string]::IsNullOrWhiteSpace($_) -eq $false){ $sasTokenParameterNameList.Add($_) } }
        $moduleUrlParameterNameList = New-Object System.Collections.Generic.List[string]
        $moduleUrlParameterNames.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries) | Foreach-Object { if([string]::IsNullOrWhiteSpace($_) -eq $false){ $moduleUrlParameterNameList.Add($_) } }
        
        if($sasTokenParameterNameList.Count -ne $moduleUrlParameterNameList.Count)
        {
            throw (Get-LocalizedString -Key "Some module url paramter names do not have a matching sas token paramter name or viceversa. Please verify the lists specified and their formats")
        }

        for($itr = 0; $itr -lt $sasTokenParameterNameList.Count; $itr++)
        {
            $sasTokenParameterNameList[$itr] = $sasTokenParameterNameList[$itr].Trim()
            $moduleUrlParameterNameList[$itr] = $moduleUrlParameterNameList[$itr].Trim()
            if ($csmParametersObject.ContainsKey($sasTokenParameterNameList[$itr]) -eq $false)
            {
                Write-Warning (Get-LocalizedString -Key "'{0}' is not present in the csm parameter file. Specify correct parameter name" -ArgumentList $sasTokenParameterNameList[$itr])
                continue
            }

            if ($csmParametersObject.ContainsKey($moduleUrlParameterNameList[$itr]) -eq $false)
            {
                Write-Warning (Get-LocalizedString -Key "'{0}' is not present in the csm parameter file. Specify correct parameter name" -ArgumentList $moduleUrlParameterNameList[$itr])
                continue
            }

            $fullBlobUri = $csmParametersObject[$moduleUrlParameterNameList[$itr]]
            $uri = $fullBlobUri -as [System.URI]
            if (($uri.AbsoluteURI -ne $null -And $uri.Scheme -match '[http|https]') -eq $false)
            {
                Write-Warning (Get-LocalizedString -Key "'{0}' '{1}' is not in the correct url format" -ArgumentList $moduleUrlParameterNameList[$itr], $fullBlobUri)
                continue
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

            Write-Verbose -Verbose "Replacing SAS token for parameter $sasTokenParameterNameList[$itr]"

            $csmParametersObject.Remove($sasTokenParameterNameList[$itr])
            $csmParametersObject.Add($sasTokenParameterNameList[$itr], $token)

            Write-Verbose -Verbose "Replaced SAS token for parameter $sasTokenParameterNameList[$itr]"
        }
    }

    return $csmParametersObject
}

function Get-MachineLogs
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose -Verbose "[Azure Resource Manager]Getting resource group $resourceGroupName"
        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -Verbose -ErrorAction Stop
        Write-Verbose -Verbose "[Azure Resource Manager]Got resource group $resourceGroupName"
        Set-Variable -Name azureResourceGroup -Value $azureResourceGroup -Scope "Global"
        
        $azureResourceGroupResources = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Compute/virtualMachines"}

        foreach($resource in $azureResourceGroupResources)
        {
            $name = $resource.Name
            Write-Verbose -Verbose "[Azure Resource Manager]Getting VM $name from resource group $resourceGroupName"
            $vmInstanceView = Get-AzureVM -Name $resource.Name -ResourceGroupName $resourceGroupName -Status -Verbose -ErrorAction Stop
            Write-Verbose -Verbose "[Azure Resource Manager]Got VM $name from resource group $resourceGroupName"

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
    }
}

function Create-AzureKeyVaultIfNotExist
{
    param([string]$azureKeyVaultName,
    [string]$resourceGroupName,
    [string]$location)

    $azureKeyVault = Get-AzureKeyVault -VaultName $azureKeyVaultName -ResourceGroupName $resourceGroupName -ErrorAction silentlycontinue

    if($azureKeyVault -eq $null)
    {
        Write-Verbose -Verbose "Creating Azure Key Vault with name $azureKeyVaultName in group $resourceGroupName at $location"

        $response = New-AzureKeyVault -VaultName $azureKeyVaultName -resourceGroupName $resourceGroupName -Location $location -EnabledForDeployment -ErrorAction Stop

        Write-Host (Get-LocalizedString -Key "Created Azure Key Vault for secrets")
    }
    else
    {
        if($azureKeyVault.EnabledForDeployment -eq $false)
        {
            throw (Get-LocalizedString -Key "Secrets not enabled to be retrieved from KeyVault '{0}' by the Microsoft.Compute resource provider, can't proceed with WinRM configuration" -ArgumentList $azureKeyVaultName)
        }
    }
}

function Create-AzureKeyVaultSecret
{
    param([string]$azureKeyVaultName,
    [string]$secretName,
    [Security.SecureString]$secretValue)

    Write-Verbose -Verbose "Setting a secret with name $secretName in an Azure Key Vault $azureKeyVaultName"

    $response = Set-AzureKeyVaultSecret -VaultName $azureKeyVaultName -Name $secretName -SecretValue $secretValue -ErrorAction Stop

    Write-Verbose -Verbose "Created a secret in an Azure Key Vault"

    return $response
}

function Create-AzureResourceGroupIfNotExist
{
    param([string]$resourceGroupName,
    [string]$location)

    $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -ErrorAction silentlycontinue
    
    if(!$azureResourceGroup)
    {
        Write-Verbose -Verbose "[Azure Resource Manager]Creating resource group $resourceGroupName in $location"

        $response = New-AzureResourceGroup -Name $resourceGroupName -Location $location -Verbose -ErrorAction Stop

        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Created resource group '{0}'" -ArgumentList $resourceGroupName)
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
