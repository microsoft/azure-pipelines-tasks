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
          [System.Collections.Hashtable]$csmParametersObject,
          [string]$resourceGroupName,
          [string]$overrideParameters)

    Switch-AzureMode AzureResourceManager
    Write-Host "[Azure Resource Manager]Creating resource group deployment with name $resourceGroupName"

    if (!$csmParametersObject)
    {
        $finalCommand = "`$azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
    }
    else
    {
        $finalCommand = "`$azureResourceGroupDeployment = New-AzureResourceGroupDeployment -Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" -TemplateParameterObject `$csmParametersObject $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
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
            
            Write-Verbose -Verbose "[Azure Call]Getting classic virtual machine:$resourceName PowerShell endpoint in resource group $resourceGroupName"
            $azureClassicVMEndpoint = $azureClassicVM | Get-AzureEndpoint -Name PowerShell
            Write-Verbose -Verbose "[Azure Call]Got classic virtual machine:$resourceName PowerShell endpoint in resource group $resourceGroupName"

            $fqdnUri = [System.Uri]$azureClassicVM.DNSName
            $resourceFQDN = $fqdnUri.Host
            $resourceWinRmHttpsPort = $azureClassicVMEndpoint.Port
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