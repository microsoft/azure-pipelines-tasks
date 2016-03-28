# This file implements IAzureUtility for Azure PowerShell version <= 0.9.8

function Create-AzureResourceGroupIfNotExist
{
    param([string]$resourceGroupName,
          [string]$location)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        try
        {
            Write-Verbose -Verbose "[Azure Resource Manager]Getting resource group:$resourceGroupName"
            $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -ErrorAction silentlyContinue
            Write-Verbose -Verbose "[Azure Resource Manager]Got resource group:$resourceGroupName"
        }
        catch
        {
            #Ignoring the exception
        }

        if(-not $azureResourceGroup -and -not [string]::IsNullOrEmpty($location))
        {
            Write-Verbose -Verbose "[Azure Resource Manager]Creating resource group $resourceGroupName in $location"
            $azureResourceGroup = New-AzureResourceGroup -Name $resourceGroupName -Location $location -Verbose -ErrorAction Stop
            Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Created resource group '{0}'" -ArgumentList $resourceGroupName)
        }
        return $azureResourceGroup
    }
}

function Deploy-AzureResourceGroup
{
    param([string]$csmFile,
          [string]$csmParametersFile,
          [string]$resourceGroupName,
          [string]$overrideParameters)

    Switch-AzureMode AzureResourceManager
    Write-Host "[Azure Resource Manager]Creating resource group deployment with name $resourceGroupName"

    if (!$csmParametersFile)
    {
        $finalCommand = "`$azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
    }
    else
    {
        $finalCommand = "`$azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" -TemplateParameterFile `$csmParametersFile $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
    }

    Write-Verbose -Verbose "$finalCommand"
    Invoke-Expression -Command $finalCommand

    @{"azureResourceGroupDeployment" = $($azureResourceGroupDeployment); "deploymentError" = $($deploymentError)}
}

function Get-AllVMInstanceView
{
    param([string]$resourceGroupName)

    Switch-AzureMode AzureResourceManager
    $VmInstanceViews = @{}
    if (-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
        $azureVMResources = Get-AzureVM -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Count of resource group:$resourceGroupName RM virtual machines type resource is $($azureVMResources.Count)"

        if($azureVMResources)
        {
            foreach($resource in $azureVMResources)
            {
                $name = $resource.Name
                Write-Verbose -Verbose "[Azure Resource Manager]Getting VM $name from resource group $resourceGroupName"
                $vmInstanceView = Get-AzureVM -Name $resource.Name -ResourceGroupName $resourceGroupName -Status -Verbose -ErrorAction Stop
                Write-Verbose -Verbose "[Azure Resource Manager]Got VM $name from resource group $resourceGroupName"
                $VmInstanceViews.Add($name, $vmInstanceView)
            }
        }
    }

    return $VmInstanceViews
}

function Start-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($machineName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Starting machine '{0}'" -ArgumentList $machineName)
        $response = Start-AzureVM -Name $machineName -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Started machine '{0}' from Azure provider" -ArgumentList $machineName)
    }
    return $response
}

function Stop-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($machineName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Stopping machine '{0}'" -ArgumentList $machineName)
        $response = Stop-AzureVM -Name $machineName -ResourceGroupName $resourceGroupName -Force -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Stopped machine '{0}' from Azure provider" -ArgumentList $machineName)
    }
    return $response
}

function Delete-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($machineName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleting machine '{0}'" -ArgumentList $machineName)
        $response = Remove-AzureVM -Name $machineName -ResourceGroupName $resourceGroupName -Force -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted machine '{0}' from Azure provider" -ArgumentList $machineName)
    }
    return $response
}

function Delete-ResourceGroup
{
    param([string]$resourceGroupName)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleting resource group '{0}'" -ArgumentList $resourceGroupName)
        Remove-AzureResourceGroup -Name $resourceGroupName -Force -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted resource group '{0}'" -ArgumentList $resourceGroupName)
    }
}

function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)

    Switch-AzureMode AzureResourceManager
    If(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        try
        {
            Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
            $azureVMResources = Get-AzureVM -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
            Write-Verbose -Verbose "[Azure Call]Count of resource group:$resourceGroupName RM virtual machines type resource is $($azureVMResources.Count)"
        }
        catch [Microsoft.WindowsAzure.Commands.Common.ComputeCloudException],[System.MissingMethodException], [System.Management.Automation.PSInvalidOperationException], [Hyak.Common.CloudException]
        {
            Write-Verbose $_.Exception.Message -Verbose
            throw (Get-LocalizedString -Key "Ensure resource group '{0}' exists and has atleast one virtual machine in it" -ArgumentList $resourceGroupName)
        }
        catch
        {
            throw
        }

        return $azureVMResources
    }
}

function Get-AzureRMResourceGroupResourcesDetails
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources)

    Switch-AzureMode AzureResourceManager
    [hashtable]$ResourcesDetails = @{}
    [hashtable]$LoadBalancerDetails = @{}
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureRMVMResources)
    {
        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        $ResourcesDetails.Add("networkInterfaceResources", $networkInterfaceResources)

        Write-Verbose -Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        $ResourcesDetails.Add("publicIPAddressResources", $publicIPAddressResources)

        Write-Verbose -Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup = Get-AzureLoadBalancer -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got load balancers in resource group $resourceGroupName"

        if($lbGroup)
        {
            foreach($lb in $lbGroup)
            {
                $lbDetails = @{}
                Write-Verbose -Verbose "[Azure Call]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
                Write-Verbose -Verbose "[Azure Call]Got load balancer in resource group $resourceGroupName"

                Write-Verbose "[Azure Call]Getting LoadBalancer Frontend Ip Config" -Verbose
                $frontEndIPConfigs = Get-AzureLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer -ErrorAction Stop -Verbose
                Write-Verbose "[Azure Call]Got LoadBalancer Frontend Ip Config" -Verbose

                Write-Verbose "[Azure Call]Getting Azure LoadBalancer Inbound NatRule Config" -Verbose
                $inboundRules = Get-AzureLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer -ErrorAction Stop -Verbose
                Write-Verbose "[Azure Call]Got Azure LoadBalancer Inbound NatRule Config" -Verbose

                $lbDetails.Add("frontEndIPConfigs", $frontEndIPConfigs)
                $lbDetails.Add("inboundRules", $inboundRules)
                $LoadBalancerDetails.Add($lb.Name, $lbDetails)
            }

            $ResourcesDetails.Add("loadBalancerResources", $LoadBalancerDetails)
        }
    }

    return $ResourcesDetails
}

function Get-AzureClassicVMsInResourceGroup
{
    param([string]$resourceGroupName)

    Switch-AzureMode AzureServiceManagement
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

    Switch-AzureMode AzureServiceManagement
    [hashtable]$classicVMsDetails = @{}
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureClassicVMResources)
    {
        Write-Verbose -Verbose "Trying to get FQDN and WinRM HTTPS Port for the classic azureVM resources from resource Group $resourceGroupName"
        foreach($azureClassicVm in $azureClassicVMResources)
        {
            $resourceName = $azureClassicVm.Name

            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName details in resource group $resourceGroupName"
            $azureClassicVM = Get-AzureVM -ServiceName $resourceGroupName -Name $resourceName -ErrorAction Stop -Verbose
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName details in resource group $resourceGroupName"
            
            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName endpoint with localport 5986 in resource group $resourceGroupName"
            $azureClassicVMEndpoint = $azureClassicVM | Get-AzureEndpoint | Where-Object {$_.LocalPort -eq '5986'}
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName endpoint with localport 5986 in resource group $resourceGroupName"

            $fqdnUri = [System.Uri]$azureClassicVM.DNSName
            $resourceFQDN = $fqdnUri.Host

            $resourceWinRmHttpsPort = $azureClassicVMEndpoint.Port
            if([string]::IsNullOrWhiteSpace($resourceWinRMHttpsPort))
            {
                Write-Verbose -Verbose "Defaulting WinRMHttpsPort of $resourceName to 5986"
                $resourceWinRMHttpsPort = "5986"
            }

            Write-Verbose -Verbose "FQDN value for resource $resourceName is $resourceFQDN"
            Write-Verbose -Verbose "WinRM HTTPS Port for resource $resourceName is $resourceWinRmHttpsPort"

            $resourceProperties = @{}
            $resourceProperties.Name = $resourceName
            $resourceProperties.fqdn = $resourceFQDN
            $resourceProperties.winRMHttpsPort = $resourceWinRmHttpsPort
            $classicVMsDetails.Add($resourceName, $resourceProperties)
        }
    }

    return $classicVMsDetails
}

function Get-AzureMachineStatus
{
    param([string]$resourceGroupName,
          [string]$name)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Getting the status for vm '{0}'" -ArgumentList $name)
        $status = Get-AzureVM -ResourceGroupName $resourceGroupName -Name $name -Status -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Call]Got the status for vm '{0}'" -ArgumentList $name)
    }
	
    return $status
}

function Get-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Getting the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        $customScriptExtension = Get-AzureVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -ErrorAction Stop -Verbose     
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

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Setting the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        $result = Set-AzureVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose		
        Write-Host (Get-LocalizedString -Key "[Azure Call]Set the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
    }
	
    return $result
}

function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Call]Removing the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        $response = Remove-AzureVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -Force -ErrorAction SilentlyContinue -Verbose		
        Write-Host (Get-LocalizedString -Key "[Azure Call]Removed the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
    }

    return $response
}

function Get-NetworkSecurityGroups
{
     param([string]$resourceGroupName,
           [string]$vmId)

    $securityGroups = New-Object System.Collections.Generic.List[System.Object]

    Switch-AzureMode AzureResourceManager
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmId))
    {
        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName for vm $vmId"
        $networkInterfaces = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName | Where-Object { $_.VirtualMachine.Id -eq $vmId }
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
                    $securityGroup = Get-AzureNetworkSecurityGroup -ResourceGroupName $sgResourceGroup -Name $securityGroupName                    
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

    Switch-AzureMode AzureResourceManager
    if($securityGroups.Count -gt 0)
    {
        foreach($securityGroup in $securityGroups)
        {
            $securityGroupName = $securityGroup.Name
            try
            {
                $winRMConfigRule = $null

                Write-Verbose -Verbose "[Azure Call]Getting network security rule config $ruleName under security group $securityGroupName"
                $winRMConfigRule = Get-AzureNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName -EA SilentlyContinue
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
                        $securityGroup = Add-AzureNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName -Direction Inbound -Access Allow -SourceAddressPrefix '*' -SourcePortRange '*' -DestinationAddressPrefix '*' -DestinationPortRange $winrmHttpsPort -Protocol * -Priority $rulePriotity
                        Write-Verbose -Verbose "[Azure Call]Added inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName"                         

                        Write-Verbose -Verbose "[Azure Call]Setting the azure network security group"
                        $result = Set-AzureNetworkSecurityGroup -NetworkSecurityGroup $securityGroup
                        Write-Verbose -Verbose "[Azure Call]Set the azure network security group"
                    }
                    catch
                    {
                        Write-Verbose -Verbose "Failed to add inbound network security rule config $ruleName with priority $rulePriotity for port $winrmHttpsPort under security group $securityGroupName : $_.Exception.Message"
                            
                        $newPort = [convert]::ToInt32($rulePriotity, 10) + 50;
                        $rulePriotity = $newPort.ToString()

                        Write-Verbose -Verbose "[Azure Call]Getting network security group $securityGroupName in resource group $resourceGroupName"
                        $securityGroup = Get-AzureNetworkSecurityGroup -ResourceGroupName $resourceGroupName -Name $securityGroupName
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

    Switch-AzureMode AzureResourceManager
    foreach($securityGroup in $securityGroups)
    {
        Write-Verbose -Verbose "[Azure Call]Removing the Rule $ruleName"
        $result = Remove-AzureNetworkSecurityRuleConfig -NetworkSecurityGroup $securityGroup -Name $ruleName | Set-AzureNetworkSecurityGroup
        Write-Verbose -Verbose "[Azure Call]Removed the Rule $ruleName"
    }
}