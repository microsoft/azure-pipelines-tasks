# Corresponding ARM calls for azure calls(latest ARM) used by AzureFileCopy Task supported till 0.9.8 version #

function Get-AzureRMResource
{
    param([string]$ResourceName,
          [string]$ResourceGroupName,
          [string]$ResourceType)

    if([string]::IsNullOrEmpty($ResourceGroupName))
    {
        Write-Verbose -Verbose "Inside Get-AzureRMResource(ResourceName)"
        $azureResource = Get-AzureResource -ResourceName $ResourceName -Verbose
    }
    else
    {
        Write-Verbose -Verbose "Inside Get-AzureRMResource(ResourceGroupName, ResourceType)"
        $azureResource = Get-AzureResource -ResourceGroupName $ResourceGroupName -ResourceType $ResourceType -Verbose
    }

    return $azureResource
}

function Get-AzureRMStorageAccountKey
{
    param([string]$ResourceGroupName,
          [string]$Name)

    Write-Verbose -Verbose "Inside Get-AzureRMStorageAccountKey(ResourceGroupName, Name)"
    $storageKey = Get-AzureStorageAccountKey -ResourceGroupName $ResourceGroupName -Name $Name
    return $storageKey
}

function Get-AzureRMVM
{
    param([string]$ResourceGroupName)

    Write-Verbose -Verbose "Inside Get-AzureRMVM(ResourceGroupName)"
    $azureVMResources = Get-AzureVM -ResourceGroupName $ResourceGroupName
    return $azureVMResources
}

function Get-AzureRMNetworkInterface
{
    param([string]$ResourceGroupName)

    Write-Verbose -Verbose "Inside Get-AzureRMNetworkInterface(ResourceGroupName)"
    $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $ResourceGroupName -Verbose
    return $networkInterfaceResources
}

function Get-AzureRMPublicIpAddress
{
    param([string]$ResourceGroupName)

    Write-Verbose -Verbose "Inside Get-AzureRMPublicIpAddress(ResourceGroupName)"
    $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $ResourceGroupName -Verbose
    return $publicIPAddressResources
}

function Get-AzureRMLoadBalancer
{
    param([string]$Name,
          [string]$ResourceGroupName)

    Write-Verbose -Verbose "Inside Get-AzureRMLoadBalancer(Name, ResourceGroupName)"
    $loadBalancer = Get-AzureLoadBalancer -Name $Name -ResourceGroupName $ResourceGroupName -Verbose
    return $loadBalancer
}

function Get-AzureRMLoadBalancerFrontendIpConfig
{
    param([object]$LoadBalancer)

    Write-Verbose -Verbose "Inside Get-AzureLoadBalancerFrontendIpConfig(LoadBalancer)"
    $frontEndIPConfigs = Get-AzureLoadBalancerFrontendIpConfig -LoadBalancer $LoadBalancer -Verbose
    return $frontEndIPConfigs
}

function Get-AzureRMLoadBalancerInboundNatRuleConfig
{
    param([object]$LoadBalancer)

    Write-Verbose -Verbose "Inside Get-AzureLoadBalancerInboundNatRuleConfig(LoadBalancer)"
    $rules = Get-AzureLoadBalancerInboundNatRuleConfig -LoadBalancer $LoadBalancer -Verbose
    return $rules
}