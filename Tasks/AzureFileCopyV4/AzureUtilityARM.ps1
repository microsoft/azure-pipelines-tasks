# This file implements IAzureUtility for AzureRM PowerShell

. "$PSScriptRoot/AzureUtilityRest.ps1"

function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    $ARMStorageAccountResourceType =  "Microsoft.Storage/storageAccounts"
    if (-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Write-Verbose "[Azure Call]Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType"
        $azureStorageAccountResourceDetails = Get-AzureRmStorageAccount -ErrorAction Stop | Where-Object { $_.StorageAccountName -eq $storageAccountName }
        Write-Verbose "[Azure Call]Retrieved resource details successfully for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType"

        $azureResourceGroupName = $azureStorageAccountResourceDetails.ResourceGroupName
        if ([string]::IsNullOrEmpty($azureResourceGroupName))
        {
            Write-Verbose "(ARM)Storage account: $storageAccountName not found"
            Write-Telemetry "Task_InternalError" "RMStorageAccountNotFound"
            Throw (Get-VstsLocString -Key "AFC_StorageAccountNotFound" -ArgumentList $storageAccountName)
        }

        return $azureResourceGroupName
    }
}

function Create-AzureStorageContext
{
    param([string]$storageAccountName,
          [string]$storageAccountKey)

    if(-not [string]::IsNullOrEmpty($storageAccountName) -and -not [string]::IsNullOrEmpty($storageAccountKey))
    {
        Write-Verbose "[Azure Call]Creating AzureStorageContext for storage account: $storageAccountName"
        $storageContext = New-AzureStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey -ErrorAction Stop
        Write-Verbose "[Azure Call]Created AzureStorageContext for storage account: $storageAccountName"

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

        Write-Verbose "[Azure Call]Creating container: $containerName in storage account: $storageAccountName"
        $container = New-AzureStorageContainer -Name $containerName -Context $storageContext -Permission Off -ErrorAction Stop
        Write-Verbose "[Azure Call]Created container: $containerName successfully in storage account: $storageAccountName"
    }
}

function Get-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext)

    $container = $null    

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
        $storageAccountName = $storageContext.StorageAccountName

        Write-Verbose "[Azure Call]Getting container: $containerName in storage account: $storageAccountName"
        try
        {
            $container = Get-AzureStorageContainer -Name $containerName -Context $storageContext -ErrorAction Stop
        }
        catch
        {
            Write-Verbose "Container: $containerName does not exist in storage account: $storageAccountName"
        }
    }

    return $container
}

function Remove-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext)

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
        $storageAccountName = $storageContext.StorageAccountName

        Write-Verbose "[Azure Call]Deleting container: $containerName in storage account: $storageAccountName"
        Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
        Write-Verbose "[Azure Call]Deleted container: $containerName in storage account: $storageAccountName"
    }
}

function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)

    If(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        try
        {
            Write-Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
            $azureRMVMResources = Get-AzureRMVM -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
            Write-Verbose "[Azure Call]Count of resource group:$resourceGroupName RM virtual machines type resource is $($azureRMVMResources.Count)"

            return $azureRMVMResources
        }
        catch [Hyak.Common.CloudException], [Microsoft.Rest.Azure.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "ExceptionMessage: $exceptionMessage"

            Write-Telemetry "Task_InternalError" "ResourceGroupNotFound"
            throw (Get-VstsLocString -Key "AFC_ResourceGroupNotFound" -ArgumentList $resourceGroupName)
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
        Write-Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureRMNetworkInterface -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("networkInterfaceResources", $networkInterfaceResources)

        Write-Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzureRMPublicIpAddress -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("publicIPAddressResources", $publicIPAddressResources)

        Write-Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup =  Get-AzureRMLoadBalancer -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose "[Azure Call]Got load balancers in resource group $resourceGroupName"

        if($lbGroup)
        {
            foreach($lb in $lbGroup)
            {
                $lbDetails = @{}
                Write-Verbose "[Azure Call]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureRMLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
                Write-Verbose "[Azure Call]Got load balancer in resource group $resourceGroupName"

                Write-Verbose "[Azure Call]Getting LoadBalancer Frontend Ip Config"
                $frontEndIPConfigs = Get-AzureRMLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer -ErrorAction Stop -Verbose
                Write-Verbose "[Azure Call]Got LoadBalancer Frontend Ip Config"

                Write-Verbose "[Azure Call]Getting Azure LoadBalancer Inbound NatRule Config"
                $inboundRules = Get-AzureRMLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer -ErrorAction Stop -Verbose
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

function Generate-AzureStorageContainerSASToken
{
    param([string]$containerName,
          [object]$storageContext,
          [System.Int32]$tokenTimeOutInMinutes)

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
        $storageAccountName = $storageContext.StorageAccountName

        Write-Verbose "[Azure Call]Generating SasToken for container: $containerName in storage: $storageAccountName with expiry time: $tokenTimeOutInMinutes minutes"
        $containerSasToken = New-AzureStorageContainerSASToken -Name $containerName -ExpiryTime (Get-Date).AddMinutes($tokenTimeOutInMinutes) -Context $storageContext -Permission rwdl
        Write-Verbose "[Azure Call]Generated SasToken: $containerSasToken successfully for container: $containerName in storage: $storageAccountName"

        return $containerSasToken
    }
}

function Get-AzureMachineStatus
{
    param([string]$resourceGroupName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-VstsLocString -Key "AFC_GetVMStatus" -ArgumentList $name)
        $status = Get-AzureRmVM -ResourceGroupName $resourceGroupName -Name $name -Status -ErrorAction Stop -Verbose
        Write-Host (Get-VstsLocString -Key "AFC_GetVMStatusComplete" -ArgumentList $name)
    }
	
    return $status
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
        Write-Host (Get-VstsLocString -Key "AFC_SetCustomScriptExtension" -ArgumentList $name, $vmName)
        Write-Verbose "Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose"
        $result = Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose		
        Write-Host (Get-VstsLocString -Key "AFC_SetCustomScriptExtensionComplete" -ArgumentList $name, $vmName)
        if($result.IsSuccessStatusCode -eq $true)
        {
            $responseJObject = [Newtonsoft.Json.Linq.JObject]::Parse(($result | ConvertTo-Json))
            $result = $responseJObject.ToObject([System.Collections.Hashtable])
            $result.Status = "Succeeded"
        }
    }

    return $result
}

function Get-NetworkSecurityGroups
{
     param([string]$resourceGroupName,
           [string]$vmId)

    $securityGroups = New-Object System.Collections.Generic.List[System.Object]

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmId))
    {
        Write-Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName for vm $vmId"
        $networkInterfaces = Get-AzureRmNetworkInterface -ResourceGroupName $resourceGroupName | Where-Object { $_.VirtualMachine.Id -eq $vmId }
        Write-Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        
        if($networkInterfaces)
        {
            $noOfNics = $networkInterfaces.Count
            Write-Verbose "Number of network interface cards present in the vm: $noOfNics"

            foreach($networkInterface in $networkInterfaces)
            {
                $networkSecurityGroupEntry = $networkInterface.NetworkSecurityGroup
                if($networkSecurityGroupEntry)
                {
                    $nsId = $networkSecurityGroupEntry.Id
					Write-Verbose "Network Security Group Id: $nsId"
					
                    $securityGroupName = $nsId.Split('/')[-1]
                    $sgResourceGroup = $nsId.Split('/')[4]                    
                    Write-Verbose "Security Group name is $securityGroupName and the related resource group $sgResourceGroup"

                    # Get the network security group object
                    Write-Verbose "[Azure Call]Getting network security group $securityGroupName in resource group $sgResourceGroup"
                    $securityGroup = Get-AzureRmNetworkSecurityGroup -ResourceGroupName $sgResourceGroup -Name $securityGroupName                    
                    Write-Verbose "[Azure Call]Got network security group $securityGroupName in resource group $sgResourceGroup"

                    $securityGroups.Add($securityGroup)
                }
            }
        }
        else
        {
            throw (Get-VstsLocString -Key "AFC_NoNetworkInterface" -ArgumentList $vmid , $resourceGroupName)
        }
    }
    else
    {
        throw (Get-VstsLocString -Key "AFC_NullOrEmptyResourceGroup")
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

                Write-Verbose "[Azure Call]Getting network security rule config $ruleName under security group $securityGroupName"
                $winRMConfigRule = Get-AzureRmNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName -EA SilentlyContinue
                Write-Verbose "[Azure Call]Got network security rule config $ruleName under security group $securityGroupName"
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
                        Write-Verbose "[Azure Call]Adding inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName"
                        $securityGroup = Add-AzureRmNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName -Direction Inbound -Access Allow -SourceAddressPrefix '*' -SourcePortRange '*' -DestinationAddressPrefix '*' -DestinationPortRange $winrmHttpsPort -Protocol * -Priority $rulePriotity
                        Write-Verbose "[Azure Call]Added inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName"                         

                        Write-Verbose "[Azure Call]Setting the azure network security group"
                        $result = Set-AzureRmNetworkSecurityGroup -NetworkSecurityGroup $securityGroup
                        Write-Verbose "[Azure Call]Set the azure network security group"
                    }
                    catch
                    {
                        Write-Verbose "Failed to add inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName : $_.Exception.Message"
                            
                        $newPort = [convert]::ToInt32($rulePriotity, 10) + 50;
                        $rulePriotity = $newPort.ToString()

                        Write-Verbose "[Azure Call]Getting network security group $securityGroupName in resource group $resourceGroupName"
                        $securityGroup = Get-AzureRmNetworkSecurityGroup -ResourceGroupName $resourceGroupName -Name $securityGroupName
                        Write-Verbose "[Azure Call]Got network security group $securityGroupName in resource group $resourceGroupName"
                        

                        if($retryCnt -eq $maxRetries)
                        {
                            throw $_
                        }

                        continue
                    }           
                        
                    Write-Verbose "Successfully added the network security group rule $ruleName with priority $rulePriotity for port $winrmHttpsPort"
                    break             
                }
            }
        }
    }
}
