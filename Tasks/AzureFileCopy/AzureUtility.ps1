# Azure Calls(RDFE/ARM) performed to get all the resource information used by AzureFileCopy Task #

$ErrorActionPreference = 'Stop'
$ARMStorageAccountResourceType =  "Microsoft.Storage/storageAccounts"
$ARMVirtualMachinesResourceType = "Microsoft.Compute/virtualMachines"
$ARMClassicVirtualMachinesResourceType = "Microsoft.ClassicCompute/virtualMachines"

function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    try
    {
        Write-Verbose "[Azure Call]Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose
        $azureStorageAccountResourceDetails = Get-AzureRMResource -ResourceName $storageAccountName | Where-Object { $_.ResourceType -eq $ARMStorageAccountResourceType }
        Write-Verbose "[Azure Call]Retrieved resource details successfully for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose

        $azureResourceGroupName = $azureStorageAccountResourceDetails.ResourceGroupName
    }
    finally
    {
        if ([string]::IsNullOrEmpty($azureResourceGroupName) -eq $true)
        {
            Write-Verbose "(ARM)Storage account: $storageAccountName not found" -Verbose
            Write-TaskSpecificTelemetry "PREREQ_StorageAccountNotFound"
            Throw (Get-LocalizedString -Key "Storage account: {0} not found. Please specify existing storage account" -ArgumentList $storageAccountName)
        }
    }

    return $azureStorageAccountResourceDetails.ResourceGroupName
}

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName)

    # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

    Write-Verbose "[Azure Call]Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose
    $storageKeyDetails = Get-AzureRMStorageAccountKey -ResourceGroupName $azureResourceGroupName -Name $storageAccount 
    $storageKey = $storageKeyDetails.Key1
    Write-Verbose "[Azure Call]Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose

    return $storageKey
}

function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName)

    Write-Verbose "[Azure Call](RDFE)Retrieving storage key for the storage account: $storageAccount" -Verbose
    $storageKeyDetails = Get-AzureStorageKey -StorageAccountName $storageAccountName
    $storageKey = $storageKeyDetails.Primary
    Write-Verbose "[Azure Call](RDFE)Retrieved storage key successfully for the storage account: $storageAccount" -Verbose

    return $storageKey
}

function Remove-AzureContainer
{
    param([string]$containerName,
          [Microsoft.WindowsAzure.Commands.Common.Storage.AzureStorageContext]$storageContext,
          [string]$storageAccount)

    Write-Verbose "[Azure Call]Deleting container: $containerName in storage account: $storageAccount" -Verbose
    Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
    Write-Verbose "[Azure Call]Deleted container: $containerName in storage account: $storageAccount" -Verbose
}

function Initialize-GlobalMaps
{
    $fqdnMap = @{}
    Set-Variable -Name fqdnMap -Value $fqdnMap -Scope "Global"

    $winRmHttpsPortMap = @{}
    Set-Variable -Name winRmHttpsPortMap -Value $winRmHttpsPortMap -Scope "Global"
}

function Does-AzureResourceMatchFilterCriteria
{
    param([object]$azureVMResource,
          [string]$resourceFilteringMethod,
          [string]$filter)

    # If no filters are provided, by default operations are performed on all azure resources
    if([string]::IsNullOrEmpty($filter))
    {
        return $true
    }

    # machine name based filtering
    if($resourceFilteringMethod -eq "machineNames")
    {        
        $machineFilterArray = $filter.Split(',').Trim()
        return ($machineFilterArray -contains $azureVMResource.Name)
    }

    # tag based filtering
    if($resourceFilteringMethod -eq "tags")
    {
        $tagsFilterArray = $filter.Split(';').Trim()
        foreach($tag in $tagsFilterArray)
        {
            $tagKeyValue = $tag.Split(':').Trim()
            $tagKey =  $tagKeyValue[0]
            $tagValues = $tagKeyValue[1]

            if($tagKeyValue.Length -ne 2 -or [string]::IsNullOrWhiteSpace($tagKey) -or [string]::IsNullOrWhiteSpace($tagValues))
            {
                Write-TaskSpecificTelemetry "FILTERING_IncorrectFormat"
                throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
            }

            $tagValueArray = $tagValues.Split(',').Trim()
            foreach($azureVMResourceTag in $azureVMResource.Tags.GetEnumerator())
            {
                if($azureVMResourceTag.Key -contains $tagKey)
                {                    
                    $azureVMTagValueArray = $azureVMResourceTag.Value.Split(",").Trim()
                    foreach($tagValue in $tagValueArray)
                    {
                        if($azureVMTagValueArray -contains $tagValue)
                        {
                            return $true
                        }
                    }
                }
            }
        }
    }

    return $false
}

function Get-FilteredAzureClassicVMsInResourceGroup
{
    param([object]$allAzureClassicVMResources,
          [string]$resourceFilteringMethod,
          [string]$filter)
    
    Write-Verbose -Verbose "Filtering azureClassicVM resources with filtering option:'$resourceFilteringMethod' and filters:'$filter'"

    $azureClassicVMResources = @()
    if($allAzureClassicVMResources)
    {
        foreach($azureClassicVMResource in $allAzureClassicVMResources)
        {
            if(Does-AzureResourceMatchFilterCriteria -azureVMResource $azureClassicVMResource -resourceFilteringMethod $resourceFilteringMethod -filter $filter)
            {
                Write-Verbose -Verbose "azureClassicVM with name: $($azureClassicVMResource.Name) matches filter criteria"
                $azureClassicVMResources += $azureClassicVMResource
            }
        }
    }

    Set-Variable -Name azureClassicVMResources -Value $azureClassicVMResources -Scope "Global"
    return $azureClassicVMResources
}

function Get-FilteredAzureRMVMsInResourceGroup
{
    param([object]$allAzureRMVMResources,
          [string]$resourceFilteringMethod,
          [string]$filter)

    Write-Verbose -Verbose "Filtering azureRMVM resources with filtering option:$resourceFilteringMethod and filters:$filter"

    $azureRMVMResources = @()
    if($allAzureRMVMResources)
    {
        foreach($azureRMVMResource in $allAzureRMVMResources)
        {
            if(Does-AzureResourceMatchFilterCriteria -azureVMResource $azureRMVMResource -resourceFilteringMethod $resourceFilteringMethod -filter $filter)
            {
                Write-Verbose -Verbose "azureRMVM with name: $($azureRMVMResource.Name) matches filter criteria"
                $azureRMVMResources += $azureRMVMResource
            }
        }   
    }

    Set-Variable -Name azureRMVMResources -Value $azureRMVMResources -Scope "Global"
    return $azureRMVMResources
}

function Get-AzureClassicVMsInResourceGroup
{
    param([string]$resourceGroupName)

    Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName classic virtual machines type resources"
    $allAzureClassicVMResources = Get-AzureVM -ServiceName $resourceGroupName -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
    Write-Verbose -Verbose "[Azure Call]Count of resource group:$resourceGroupName classic virtual machines type resource is $($allAzureClassicVMResources.Count)"

    return $allAzureClassicVMResources
}

function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)

    try
    {
        Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
        $allAzureRMVMResources = Get-AzureRMVM -ResourceGroupName $resourceGroupName
        Write-Verbose -Verbose "[Azure Call]Count of resource group:$resourceGroupName RM virtual machines type resource is $($allAzureRMVMResources.Count)"
    }
    catch [Microsoft.WindowsAzure.Commands.Common.ComputeCloudException], [System.MissingMethodException], [System.Management.Automation.PSInvalidOperationException]
    {
        Write-Verbose $_.Exception.Message -Verbose
        Write-TaskSpecificTelemetry "PREREQ_NoRGOrVMResources"
        throw (Get-LocalizedString -Key "Ensure resource group '{0}' exists and has atleast one virtual machine in it" -ArgumentList $resourceGroupName)
    }
    catch
    {
        Write-TaskSpecificTelemetry "AZUREPLATFORM_UnknownGetRMVMError"
        throw
    }

    return $allAzureRMVMResources
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureRMVMResources)
    {
        Write-Verbose "Trying to get FQDN for the RM azureVM resources from resource group: $resourceGroupName" -Verbose

        Write-Verbose "[Azure Call]Getting LoadBalancer Frontend Ip Config" -Verbose
        $frontEndIPConfigs = Get-AzureRMLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer
        Write-Verbose "[Azure Call]Got LoadBalancer Frontend Ip Config" -Verbose

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

    Write-Verbose "Got FQDN for the RM azureVM resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-MachineNameFromId
{
    param([string]$resourceGroupName,
          [System.Collections.Hashtable]$map,
          [string]$mapParameter,
          [boolean]$throwOnTotalUnavaialbility)

    if($map)
    {
        $errorCount = 0
        foreach($vm in $azureRMVMResources)
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
            if($errorCount -eq $azureRMVMResources.Count -and $azureRMVMResources.Count -ne 0)
            {
                Write-TaskSpecificTelemetry "DEPLOYMENT_FetchPropertyFromMap"
                throw (Get-LocalizedString -Key "Unable to get {0} for all resources in ResourceGroup : '{1}'" -ArgumentList $mapParameter, $resourceGroupName)
            }
            else
            {
                if($errorCount -gt 0 -and $errorCount -ne $azureRMVMResources.Count)
                {
                    Write-Warning (Get-LocalizedString -Key "Unable to get {0} for '{1}' resources in ResourceGroup : '{2}'" -ArgumentList $mapParameter, $errorCount, $resourceGroupName)
                }
            }
        }

        return $map
    }
}

function Get-MachinesFqdns
{
    param([string]$resourceGroupName)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureRMVMResources)
    {
        Write-Verbose "Trying to get FQDN for the RM azureVM resources from resource Group $resourceGroupName" -Verbose

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

        $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
    }

    Write-Verbose "Got FQDN for the RM azureVM resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-FrontEndPorts
{
    param([string]$backEndPort,
          [System.Collections.Hashtable]$portList)

    if([string]::IsNullOrEmpty($backEndPort) -eq $false -and $networkInterfaceResources -and $loadBalancer -and $azureRMVMResources)
    {
        Write-Verbose "Trying to get front end ports for $backEndPort" -Verbose

        Write-Verbose "[Azure Call]Getting Azure LoadBalancer Inbound NatRule Config" -Verbose
        $rules = Get-AzureRMLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer
        Write-Verbose "[Azure Call]Got Azure LoadBalancer Inbound NatRule Config" -Verbose

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

function Get-MachineConnectionInformationForClassicVms
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $azureClassicVMResources)
    {
        Write-Verbose -Verbose "Trying to get FQDN and WinRM HTTPS Port for the classic azureVM resources from resource Group $resourceGroupName"

        foreach($azureClassicVm in $azureClassicVMResources)
        {
            $resourceName = $azureClassicVm.Name

            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName details in resource group $resourceGroupName"
            $azureClassicVMDetails = Get-AzureVM -ServiceName $resourceGroupName -Name $resourceName -Verbose
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName details in resource group $resourceGroupName"
            
            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName PowerShell endpoint in resource group $resourceGroupName"
            $azureClassicVMEndpoint = $azureClassicVMDetails | Get-AzureEndpoint -Name PowerShell
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName PowerShell endpoint in resource group $resourceGroupName"

            $fqdnUri = [System.Uri]$azureClassicVMDetails.DNSName
            $fqdnMap[$resourceName] = $fqdnUri.Host
            Write-Verbose -Verbose "FQDN value for resource $resourceName is $($fqdnUri.Host)"

            $winRmHttpsPortMap[$resourceName] = $azureClassicVMEndpoint.Port
            Write-Verbose -Verbose "WinRM HTTPS Port for resource $resourceName is $($azureClassicVMEndpoint.Port)"
        }

        Write-Verbose -Verbose "Got FQDN and WinRM HTTPS Port for the classic azureVM resources from resource Group $resourceGroupName"
    }
}

function Get-MachineConnectionInformationForRMVms
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureRMNetworkInterface -ResourceGroupName $resourceGroupName -Verbose
        Write-Verbose -Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        Set-Variable -Name networkInterfaceResources -Value $networkInterfaceResources -Scope "Global"

        Write-Verbose -Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzureRMPublicIpAddress -ResourceGroupName $resourceGroupName -Verbose
        Write-Verbose -Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        Set-Variable -Name publicIPAddressResources -Value $publicIPAddressResources -Scope "Global"

        Write-Verbose -Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup = Get-AzureRMResource -ResourceGroupName $resourceGroupName -ResourceType "Microsoft.Network/loadBalancers" -Verbose
        Write-Verbose -Verbose "[Azure Call]Got load balancers in resource group $resourceGroupName"

        if($lbGroup)
        {
            foreach($lb in $lbGroup)
            {
                Write-Verbose -Verbose "[Azure Call]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureRMLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -Verbose
                Write-Verbose -Verbose "[Azure Call]Got load balancer in resource group $resourceGroupName"
                Set-Variable -Name loadBalancer -Value $loadBalancer -Scope "Global"

                $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName
                $winRmHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRmHttpsPortMap
            }

            $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
            $winRmHttpsPortMap = Get-MachineNameFromId -Map $winRmHttpsPortMap -MapParameter "Front End port" -ThrowOnTotalUnavaialbility $false
        }
        else
        {
            $fqdnMap = Get-MachinesFqdns -resourceGroupName $resourceGroupName
            $winRmHttpsPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
        }
    }
}

function Get-AzureVMResourcesProperties
{
    param([object]$resources)

    [hashtable]$resourcesPropertyBag = @{}
    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        $resourceFQDN = $fqdnMap[$resourceName]
        $resourceWinRmHttpsPort = $winRmHttpsPortMap[$resourceName]
        if([string]::IsNullOrWhiteSpace($resourceWinRmHttpsPort))
        {
            Write-Verbose -Verbose "Defaulting WinRmHttpsPort of $resourceName to 5986"
            $resourceWinRmHttpsPort = "5986"
        }

        $resourceProperties = @{}
        $resourceProperties.Name = $resourceName
        $resourceProperties.fqdn = $resourceFQDN
        $resourceProperties.winRMHttpsPort = $resourceWinRmHttpsPort

        $resourcesPropertyBag.Add($resourceName, $resourceProperties)
    }

    return $resourcesPropertyBag
}