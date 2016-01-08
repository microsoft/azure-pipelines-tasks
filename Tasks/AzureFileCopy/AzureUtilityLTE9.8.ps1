# This file implements IAzureUtility for Azure PowerShell version <= 0.9.8

function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Switch-AzureMode AzureServiceManagement

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
        Switch-AzureMode AzureResourceManager

        try
        {
            Write-Verbose "[Azure Call]Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose
            $azureStorageAccountResourceDetails = (Get-AzureResource -ResourceName $storageAccountName -ErrorAction Stop) | Where-Object { $_.ResourceType -eq $ARMStorageAccountResourceType }
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

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Switch-AzureMode AzureResourceManager

        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose
        $storageKeyDetails = Get-AzureStorageAccountKey -ResourceGroupName $azureResourceGroupName -Name $storageAccountName -ErrorAction Stop
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
        Switch-AzureMode AzureServiceManagement

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
        Switch-AzureMode AzureServiceManagement

        Write-Verbose -Verbose "[Azure Call](RDFE)Getting resource group:$resourceGroupName classic virtual machines type resources"
        $azureClassicVMResources = Get-AzureVM -ServiceName $resourceGroupName -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
        Write-Verbose -Verbose "[Azure Call](RDFE)Count of resource group:$resourceGroupName classic virtual machines type resource is $($azureClassicVMResources.Count)"
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
        Switch-AzureMode AzureServiceManagement

        Write-Verbose -Verbose "Trying to get FQDN and WinRM HTTPS Port for the classic azureVM resources from resource Group $resourceGroupName"
        foreach($azureClassicVMResource in $azureClassicVMResources)
        {
            $resourceName = $azureClassicVMResource.Name

            Write-Verbose -Verbose "[Azure Call](RDFE)Getting classic virtual machine:$resourceName details in resource group $resourceGroupName"
            $azureClassicVM = Get-AzureVM -ServiceName $resourceGroupName -Name $resourceName -ErrorAction Stop -Verbose
            Write-Verbose -Verbose "[Azure Call](RDFE)Got classic virtual machine:$resourceName details in resource group $resourceGroupName"
            
            Write-Verbose -Verbose "[Azure Call](RDFE)Getting classic virtual machine:$resourceName PowerShell endpoint in resource group $resourceGroupName"
            $azureClassicVMEndpoint = $azureClassicVM | Get-AzureEndpoint -Name PowerShell
            Write-Verbose -Verbose "[Azure Call](RDFE)Got classic virtual machine:$resourceName PowerShell endpoint in resource group $resourceGroupName"

            $fqdnUri = [System.Uri]$azureClassicVM.DNSName
            $resourceFQDN = $fqdnUri.Host
            $resourceWinRMHttpsPort = $azureClassicVMEndpoint.Port
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
        Switch-AzureMode AzureResourceManager

        try
        {
            Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
            $azureRMVMResources = Get-AzureVM -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
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
        Switch-AzureMode AzureResourceManager

        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("networkInterfaceResources", $networkInterfaceResources)

        Write-Verbose -Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Verbose -Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        $azureRGResourcesDetails.Add("publicIPAddressResources", $publicIPAddressResources)

        Write-Verbose -Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup = Get-AzureResource -ResourceGroupName $resourceGroupName -ResourceType "Microsoft.Network/loadBalancers" -ErrorAction Stop -Verbose
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
