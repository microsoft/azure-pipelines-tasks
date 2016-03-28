# This file implements IAzureUtility for Azure PowerShell version >= 1.0.0

function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Write-Verbose "[Azure Call](RDFE)Retrieving storage key for the storage account: $storageAccount" -Verbose
        $storageKeyDetails = Get-AzureStorageKey -StorageAccountName $storageAccountName -ErrorAction Stop
        $storageKey = $storageKeyDetails.Primary
        Write-Verbose "[Azure Call](RDFE)Retrieved storage key successfully for the storage account: $storageAccount" -Verbose

        return $storageKey
    }
}

function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    $ARMStorageAccountResourceType =  "Microsoft.Storage/storageAccounts"
    if (-not [string]::IsNullOrEmpty($storageAccountName))
    {
        try
        {
            Write-Verbose "[Azure Call]Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose
            $azureStorageAccountResourceDetails = (Get-AzureRMResource -ErrorAction Stop) | Where-Object { ($_.ResourceType -eq $ARMStorageAccountResourceType) -and ($_.ResourceName -eq $storageAccountName)}
            Write-Verbose "[Azure Call]Retrieved resource details successfully for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose

            $azureResourceGroupName = $azureStorageAccountResourceDetails.ResourceGroupName
            return $azureStorageAccountResourceDetails.ResourceGroupName
        }
        finally
        {
            if ([string]::IsNullOrEmpty($azureResourceGroupName))
            {
                Write-Verbose "(ARM)Storage account: $storageAccountName not found" -Verbose

                Write-TaskSpecificTelemetry "PREREQ_RMStorageAccountNotFound"
                Throw (Get-LocalizedString -Key "Storage account: {0} not found. Selected Connection 'ServicePrincipal' supports storage account of Azure Resource Manager type only." -ArgumentList $storageAccountName)
            }
        }
    }
}

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName)

    if (-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose
        $storageKeyDetails = Get-AzureRMStorageAccountKey -ResourceGroupName $azureResourceGroupName -Name $storageAccountName -ErrorAction Stop
        $storageKey = $storageKeyDetails.Key1
        Write-Verbose "[Azure Call]Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose

        return $storageKey
    }
}

function Create-AzureStorageContext
{
    param([string]$storageAccountName,
          [string]$storageAccountKey)

    if(-not [string]::IsNullOrEmpty($storageAccountName) -and -not [string]::IsNullOrEmpty($storageAccountKey))
    {
        Write-Verbose "[Azure Call]Creating AzureStorageContext for storage account: $storageAccountName" -Verbose
        $storageContext = New-AzureStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey -ErrorAction Stop
        Write-Verbose "[Azure Call]Created AzureStorageContext for storage account: $storageAccountName" -Verbose

        return $storageContext
    }
}

function Create-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext)

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
        $storageAccountName = $storageContext.StorageAccountName

        Write-Verbose "[Azure Call]Creating container: $containerName in storage account: $storageAccountName" -Verbose
        $container = New-AzureStorageContainer -Name $containerName -Context $storageContext -Permission Container -ErrorAction Stop
        Write-Verbose "[Azure Call]Created container: $containerName successfully in storage account: $storageAccountName" -Verbose
    }
}

function Remove-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext)

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
        $storageAccountName = $storageContext.StorageAccountName

        Write-Verbose "[Azure Call]Deleting container: $containerName in storage account: $storageAccountName" -Verbose
        Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
        Write-Verbose "[Azure Call]Deleted container: $containerName in storage account: $storageAccountName" -Verbose
    }
}

function Get-AzureCloudService
{
    param([string]$cloudServiceName)

    if(-not [string]::IsNullOrEmpty($cloudServiceName))
    {
        Write-Verbose -Verbose "[Azure Call](RDFE) Getting details of cloud service: $cloudServiceName"
        $azureCloudService = Get-AzureService -ServiceName $cloudServiceName -ErrorAction Stop
        Write-Verbose -Verbose "[Azure Call](RDFE) Got details of cloud service: $cloudServiceName"

        return
    }
}

function Get-AzureClassicVMsInResourceGroup
{
    param([string]$resourceGroupName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName classic virtual machines type resources"
        $azureClassicVMResources = Get-AzureVM -ServiceName $resourceGroupName -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
        Write-Verbose -Verbose "[Azure Call]Count of resource group:$resourceGroupName classic virtual machines type resource is $($azureClassicVMResources.Count)"
    }

    return $azureClassicVMResources
}

function Get-AzureClassicVMsConnectionDetailsInResourceGroup
{
    param([string]$resourceGroupName,
          [object]$azureClassicVMResources)

    [hashtable]$azureClassicVMsDetails = @{}
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureClassicVMResources)
    {
        Write-Verbose -Verbose "Trying to get FQDN and WinRM HTTPS Port for the classic azureVM resources from resource Group $resourceGroupName"
        foreach($azureClassicVMResource in $azureClassicVMResources)
        {
            $resourceName = $azureClassicVMResource.Name

            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName details in resource group $resourceGroupName"
            $azureClassicVM = Get-AzureVM -ServiceName $resourceGroupName -Name $resourceName -ErrorAction Stop -Verbose
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName details in resource group $resourceGroupName"

            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName endpoint with localport 5986 in resource group $resourceGroupName"
            $azureClassicVMEndpoint = $azureClassicVM | Get-AzureEndpoint | Where-Object {$_.LocalPort -eq '5986'}
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName endpoint with localport 5986 in resource group $resourceGroupName"

            $fqdnUri = [System.Uri]$azureClassicVM.DNSName
            $resourceFQDN = $fqdnUri.Host

            $resourceWinRMHttpsPort = $azureClassicVMEndpoint.Port
            if([string]::IsNullOrWhiteSpace($resourceWinRMHttpsPort))
            {
                Write-Verbose -Verbose "Defaulting WinRMHttpsPort of $resourceName to 5986"
                $resourceWinRMHttpsPort = "5986"
            }

            Write-Verbose -Verbose "FQDN value for resource $resourceName is $resourceFQDN"
            Write-Verbose -Verbose "WinRM HTTPS Port for resource $resourceName is $resourceWinRMHttpsPort"

            $resourceProperties = @{}
            $resourceProperties.Name = $resourceName
            $resourceProperties.fqdn = $resourceFQDN
            $resourceProperties.winRMHttpsPort = $resourceWinRMHttpsPort
            $azureClassicVMsDetails.Add($resourceName, $resourceProperties)
        }
    }

    return $azureClassicVMsDetails
}

function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)

    If(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        try
        {
            Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
            $azureRMVMResources = Get-AzureRMVM -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
            Write-Verbose -Verbose "[Azure Call]Count of resource group:$resourceGroupName RM virtual machines type resource is $($azureRMVMResources.Count)"

            return $azureRMVMResources
        }
        catch [Hyak.Common.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "ExceptionMessage: $exceptionMessage" -Verbose

            Write-TaskSpecificTelemetry "PREREQ_ResourceGroupNotFound"
            throw (Get-LocalizedString -Key "Provided resource group '{0}' does not exist." -ArgumentList $resourceGroupName)
        }
    }
}

function Get-AzureRMResourceGroupResourcesDetails
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources)

    [hashtable]$azureRGResourcesDetails = @{}
    [hashtable]$loadBalancerDetails = @{}
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureRMVMResources)
    {
        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureRMNetworkInterface -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("networkInterfaceResources", $networkInterfaceResources)

        Write-Verbose -Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzureRMPublicIpAddress -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("publicIPAddressResources", $publicIPAddressResources)

        Write-Verbose -Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup =  Get-AzureRMLoadBalancer -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got load balancers in resource group $resourceGroupName"

        if($lbGroup)
        {
            foreach($lb in $lbGroup)
            {
                $lbDetails = @{}
                Write-Verbose -Verbose "[Azure Call]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureRMLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
                Write-Verbose -Verbose "[Azure Call]Got load balancer in resource group $resourceGroupName"

                Write-Verbose "[Azure Call]Getting LoadBalancer Frontend Ip Config" -Verbose
                $frontEndIPConfigs = Get-AzureRMLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer -ErrorAction Stop -Verbose
                Write-Verbose "[Azure Call]Got LoadBalancer Frontend Ip Config" -Verbose

                Write-Verbose "[Azure Call]Getting Azure LoadBalancer Inbound NatRule Config" -Verbose
                $inboundRules = Get-AzureRMLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer -ErrorAction Stop -Verbose
                Write-Verbose "[Azure Call]Got Azure LoadBalancer Inbound NatRule Config" -Verbose

                $lbDetails.Add("frontEndIPConfigs", $frontEndIPConfigs)
                $lbDetails.Add("inboundRules", $inboundRules)
                $loadBalancerDetails.Add($lb.Name, $lbDetails)
            }

            $azureRGResourcesDetails.Add("loadBalancerResources", $loadBalancerDetails)
        }
    }

    return $azureRGResourcesDetails
}

function Generate-AzureStorageContainerSASToken
{
    param([string]$containerName,
          [object]$storageContext,
          [System.Int32]$tokenTimeOutInHours)

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
        $storageAccountName = $storageContext.StorageAccountName

        Write-Verbose "[Azure Call]Generating SasToken for container: $containerName in storage: $storageAccountName with expiry time: $tokenTimeOutInHours hours" -Verbose
        $containerSasToken = New-AzureStorageContainerSASToken -Name $containerName -ExpiryTime (Get-Date).AddHours($tokenTimeOutInHours) -Context $storageContext -Permission rwdl
        Write-Verbose "[Azure Call]Generated SasToken: $containerSasToken successfully for container: $containerName in storage: $storageAccountName" -Verbose

        return $containerSasToken
    }
}

function Get-AzureMachineStatus
{
    param([string]$resourceGroupName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Getting the status for vm '{0}'" -ArgumentList $name)
        $status = Get-AzureRmVM -ResourceGroupName $resourceGroupName -Name $name -Status -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Call]Got the status for vm '{0}'" -ArgumentList $name)
    }
	
    return $status
}

function Get-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Getting the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        $customScriptExtension = Get-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -ErrorAction Stop -Verbose     
        Write-Host (Get-LocalizedString -Key "[Azure Call]Got the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
    }
	
    return $customScriptExtension
}

function Set-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [string[]]$fileUri,
          [string]$run,
          [string]$argument,
          [string]$location)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Setting the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        $result = Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose		
        Write-Host (Get-LocalizedString -Key "[Azure Call]Set the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
    }
	
    return $result
}

function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Removing the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        $response = Remove-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -Force -ErrorAction SilentlyContinue -Verbose		
        Write-Host (Get-LocalizedString -Key "[Azure Call]Removed the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
    }

    return $response
}

function Get-NetworkSecurityGroups
{
     param([string]$resourceGroupName,
           [string]$vmId)

    $securityGroups = New-Object System.Collections.Generic.List[System.Object]

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmId))
    {
        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName for vm $vmId"
        $networkInterfaces = Get-AzureRmNetworkInterface -ResourceGroupName $resourceGroupName | Where-Object { $_.VirtualMachine.Id -eq $vmId }
        Write-Verbose -Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        
        if($networkInterfaces)
        {
            $noOfNics = $networkInterfaces.Count
            Write-Verbose -Verbose "Number of network interface cards present in the vm: $noOfNics"

            foreach($networkInterface in $networkInterfaces)
            {
                $networkSecurityGroupEntry = $networkInterface.NetworkSecurityGroup
                if($networkSecurityGroupEntry)
                {
                    $nsId = $networkSecurityGroupEntry.Id
					Write-Verbose -Verbose "Network Security Group Id: $nsId"
					
                    $securityGroupName = $nsId.Split('/')[-1]
                    $sgResourceGroup = $nsId.Split('/')[4]                    
                    Write-Verbose -Verbose "Security Group name is $securityGroupName and the related resource group $sgResourceGroup"

                    # Get the network security group object
                    Write-Verbose -Verbose "[Azure Call]Getting network security group $securityGroupName in resource group $sgResourceGroup"
                    $securityGroup = Get-AzureRmNetworkSecurityGroup -ResourceGroupName $sgResourceGroup -Name $securityGroupName                    
                    Write-Verbose -Verbose "[Azure Call]Got network security group $securityGroupName in resource group $sgResourceGroup"

                    $securityGroups.Add($securityGroup)
                }
            }
        }
        else
        {
            throw (Get-LocalizedString -Key "[Azure Call]No network interface found with virtual machine id {0} under resource group {1}" -ArgumentList $vmid , $resourceGroupName)
        }
    }
    else
    {
        throw (Get-LocalizedString -Key "[Azure Call]Resource group name and virtual machine id should not be null or empty")
    }
    
    return $securityGroups
}

function Add-NetworkSecurityRuleConfig
{
    param([string]$resourceGroupName,
          [object]$securityGroups,
          [string]$ruleName,
          [string]$rulePriotity,
          [string]$winrmHttpsPort)

    if($securityGroups.Count -gt 0)
    {
        foreach($securityGroup in $securityGroups)
        {
            $securityGroupName = $securityGroup.Name
            try
            {
                $winRMConfigRule = $null

                Write-Verbose -Verbose "[Azure Call]Getting network security rule config $ruleName under security group $securityGroupName"
                $winRMConfigRule = Get-AzureRmNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName -EA SilentlyContinue
                Write-Verbose -Verbose "[Azure Call]Got network security rule config $ruleName under security group $securityGroupName"
            }
            catch
            { 
                #Ignore the exception
            }

            # Add the network security rule if it doesn't exists
            if(-not $winRMConfigRule)                                                              
            {           
                $maxRetries = 3
                for($retryCnt=1; $retryCnt -le $maxRetries; $retryCnt++)
                {
                    try
                    {
                        Write-Verbose -Verbose "[Azure Call]Adding inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName"
                        $securityGroup = Add-AzureRmNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName -Direction Inbound -Access Allow -SourceAddressPrefix '*' -SourcePortRange '*' -DestinationAddressPrefix '*' -DestinationPortRange $winrmHttpsPort -Protocol * -Priority $rulePriotity
                        Write-Verbose -Verbose "[Azure Call]Added inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName"                         

                        Write-Verbose -Verbose "[Azure Call]Setting the azure network security group"
                        $result = Set-AzureRmNetworkSecurityGroup -NetworkSecurityGroup $securityGroup
                        Write-Verbose -Verbose "[Azure Call]Set the azure network security group"
                    }
                    catch
                    {
                        Write-Verbose -Verbose "Failed to add inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName : $_.Exception.Message"
                            
                        $newPort = [convert]::ToInt32($rulePriotity, 10) + 50;
                        $rulePriotity = $newPort.ToString()

                        Write-Verbose -Verbose "[Azure Call]Getting network security group $securityGroupName in resource group $resourceGroupName"
                        $securityGroup = Get-AzureRmNetworkSecurityGroup -ResourceGroupName $resourceGroupName -Name $securityGroupName
                        Write-Verbose -Verbose "[Azure Call]Got network security group $securityGroupName in resource group $resourceGroupName"
                        

                        if($retryCnt -eq $maxRetries)
                        {
                            throw $_
                        }

                        continue
                    }           
                        
                    Write-Verbose -Verbose "Successfully added the network security group rule $ruleName with priority $rulePriotity for port $winrmHttpsPort"
                    break             
                }
            }
        }
    }
}

# Used only in test code
function Remove-NetworkSecurityRuleConfig
{
    param([object] $securityGroups,
          [string] $ruleName)

    foreach($securityGroup in $securityGroups)
    {
        Write-Verbose -Verbose "[Azure Call]Removing the Rule $ruleName"
        $result = Remove-AzureRmNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName | Set-AzureRmNetworkSecurityGroup
        Write-Verbose -Verbose "[Azure Call]Removed the Rule $ruleName"
    }
}