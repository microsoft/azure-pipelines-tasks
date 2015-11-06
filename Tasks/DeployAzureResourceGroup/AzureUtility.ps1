# Azure Calls(RDFE/ARM) performed to get all the resource information used by AzureFileCopy Task #

$ErrorActionPreference = 'Stop'

function Get-AzureVMsInResourceGroup
{
    param([string]$resourceGroupName)

    try
    {
        Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName virtual machines type resources"
        $azureVMResources = Get-AzureRMVM -ResourceGroupName $resourceGroupName -Verbose
        Write-Verbose -Verbose "[Azure Call]Got resource group:$resourceGroupName virtual machines type resources"
        Set-Variable -Name azureVMResources -Value $azureVMResources -Scope "Global"
    }
    catch [Microsoft.WindowsAzure.Commands.Common.ComputeCloudException]
    {
        Write-Error $_.Exception.InnerException.Message -Verbose
    }
    catch
    {
        Write-Error $_.Exception.Message -Verbose
    }

    return $azureVMResources
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVMResources)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource group: $resourceGroupName" -Verbose

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

    Write-Verbose "Got FQDN for the resources from resource Group $resourceGroupName" -Verbose

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
        foreach($vm in $azureVMResources)
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
            if($errorCount -eq $azureVMResources.Count -and $azureVMResources.Count -ne 0)
            {
                throw (Get-LocalizedString -Key "Unable to get {0} for all resources in ResourceGroup : '{1}'" -ArgumentList $mapParameter, $resourceGroupName)
            }
            else
            {
                if($errorCount -gt 0 -and $errorCount -ne $azureVMResources.Count)
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

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVMResources)
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

        $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
    }

    Write-Verbose "Got FQDN for the resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-FrontEndPorts
{
    param([string]$backEndPort,
          [System.Collections.Hashtable]$portList)

    if([string]::IsNullOrEmpty($backEndPort) -eq $false -and $networkInterfaceResources -and $loadBalancer -and $azureVMResources)
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

function Get-MachineConnectionInformation
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

        $fqdnMap = @{}
        Set-Variable -Name fqdnMap -Value $fqdnMap -Scope "Global"

        $winRmHttpsPortMap = @{}
        Set-Variable -Name winRmHttpsPortMap -Value $winRmHttpsPortMap -Scope "Global"

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