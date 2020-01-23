Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName,
          [object]$serviceEndpoint)

    if (-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceid"
        
        $storageKeyDetails = Get-AzRMStorageKeys $azureResourceGroupName $storageAccountName $serviceEndpoint
        $storageKey = $storageKeyDetails.Key1
        Write-Verbose "[Azure Call]Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName"

        return $storageKey
    }
}

function Get-AzureBlobStorageEndpointFromARM
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage account endpoint for the storage account: $storageAccount in resource group: $azureResourceGroupName"
        
        $storageAccountInfo = Get-AzRMStorageAccount $azureResourceGroupName $storageAccountName $endpoint -ErrorAction Stop
        $storageAccountEnpoint = $storageAccountInfo.PrimaryEndpoints[0].blob
        Write-Verbose "[Azure Call]Retrieved storage account endpoint successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName"

        return $storageAccountEnpoint
    }          
}

function Get-AzureStorageAccountTypeFromARM
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage account type for the storage account: $storageAccount in resource group: $azureResourceGroupName"
        $storageAccountInfo = Get-AzRMStorageAccount $azureResourceGroupName $storageAccountName $endpoint -ErrorAction Stop
        $storageAccountType = $storageAccountInfo.sku.tier
                    Write-Verbose "[Azure Call]Retrieved storage account type successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName"

        return $storageAccountType
    }          
}

function Get-AzureMachineCustomScriptExtension
{
   param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
    {
        Write-Host (Get-VstsLocString -Key "AFC_GetCustomScriptExtension" -ArgumentList $name, $vmName)
        $customScriptExtension = Get-AzRmVmCustomScriptExtension $resourceGroupName $vmName $name $endpoint  
        Write-Host (Get-VstsLocString -Key "AFC_GetCustomScriptExtensionComplete" -ArgumentList $name, $vmName)
    }
                
    return $customScriptExtension
}

function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-VstsLocString -Key "AFC_RemoveCustomScriptExtension" -ArgumentList $name, $vmName)
        $response = Remove-AzRmVMCustomScriptExtension $resourceGroupName $vmName $name $endpoint        
        Write-Host (Get-VstsLocString -Key "AFC_RemoveCustomScriptExtensionComplete" -ArgumentList $name, $vmName)
    }

    return $response
}

function Get-AzureRMResourceGroupResourcesDetailsForAzureStack
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources,
          [object]$endpoint)

    [hashtable]$azureRGResourcesDetails = @{}
    [hashtable]$loadBalancerDetails = @{}
    
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureRMVMResources)
    {
        Write-Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureNetworkInterfaceDetails -ResourceGroupName $resourceGroupName -endpoint $endpoint
        Write-Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("networkInterfaceResources", $networkInterfaceResources)

        Write-Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzurePublicIpAddressDetails -ResourceGroupName $resourceGroupName -endpoint $endpoint
        Write-Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("publicIPAddressResources", $publicIPAddressResources)

        Write-Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup =  Get-AzureLoadBalancersDetails -ResourceGroupName $resourceGroupName -endpoint $endpoint
        Write-Verbose "[Azure Call]Got load balancers in resource group $resourceGroupName"

        if($lbGroup)
        {
            foreach($lb in $lbGroup)
            {
                $lbDetails = @{}
                Write-Verbose "[Azure Call]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureLoadBalancerDetails -Name $lb.Name -ResourceGroupName $resourceGroupName -endpoint $endpoint
                Write-Verbose "[Azure Call]Got load balancer in resource group $resourceGroupName"

                Write-Verbose "[Azure Call]Getting LoadBalancer Frontend Ip Config"
                $frontEndIPConfigs = Get-AzureRMLoadBalancerFrontendIpConfigDetails -LoadBalancer $loadBalancer
                Write-Verbose "[Azure Call]Got LoadBalancer Frontend Ip Config"

                Write-Verbose "[Azure Call]Getting Azure LoadBalancer Inbound NatRule Config"
                $inboundRules = Get-AzureRMLoadBalancerInboundNatRuleConfigDetails -LoadBalancer $loadBalancer
                Write-Verbose "[Azure Call]Got Azure LoadBalancer Inbound NatRule Config"

                $lbDetails.Add("frontEndIPConfigs", $frontEndIPConfigs)
                $lbDetails.Add("inboundRules", $inboundRules)
                $loadBalancerDetails.Add($lb.Name, $lbDetails)
            }

            $azureRGResourcesDetails.Add("loadBalancerResources", $loadBalancerDetails)
        }
    }

    return $azureRGResourcesDetails
}