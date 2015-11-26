function Get-AzureRMResource
{
    param([string]$ResourceName,
          [string]$ResourceType,
          [string]$ResourceGroupName,
          [string]$ErrorAction,
          [switch]$Verbose)
            
    Write-Verbose -Verbose "Inside Get-AzureRMResource"
    $arguments = @{ }

    if($ResourceName)
    {
        $arguments.Add("ResourceName", $ResourceName)
    }
    if($ResourceType)
    {
        $arguments.Add("ResourceType", $ResourceType)
    }
    if($ResourceGroupName)
    {
        $arguments.Add("ResourceGroupName", $ResourceGroupName)
    }
    if($ErrorAction)
    {
        $arguments.Add("ErrorAction", $ErrorAction)
    }
    if($Verbose.IsPresent)
    {
        $arguments.Add("Verbose", $true)
    }

    Get-AzureResource @arguments
}

function Get-AzureRMResourceGroup
{
    param([string]$ResourceGroupName,
          [string]$ErrorAction)
    Write-Verbose -Verbose "Inside Get-AzureRMResourceGroup"
    Get-AzureResourceGroup -ResourceGroupName $ResourceGroupName -ErrorAction $ErrorAction
}

function Get-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction,
          [switch]$Status,
          [switch]$Verbose)

    Write-Verbose -Verbose "Inside Get-AzureRMVM"
    $arguments = @{ "ResourceGroupName" = $ResourceGroupName; }
    if($Name)
    {
        $arguments.Add("Name", $Name)
    }
    if($ErrorAction)
    {
        $arguments.Add("ErrorAction", $ErrorAction)
    }
    if($Status.IsPresent)
    {
        $arguments.Add("Status", $true)
    }

    Get-AzureVM @arguments
}

function New-AzureRMResourceGroup
{
    param([string]$Name,
          [string]$Location,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside New-AzureRMResourceGroup"
    New-AzureResourceGroup -Name $Name -Location $Location -Verbose -ErrorAction $ErrorAction
}

function Remove-AzureRMResourceGroup
{
    param([string]$Name,
          [string]$ResourceType,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Remove-AzureRMResourceGroup"
    Remove-AzureResourceGroup -Name $Name -Force -ErrorAction $ErrorAction -Verbose
}

function Remove-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Remove-AzureRMVM"
    $response = Remove-AzureVM  -Name $Name -ResourceGroupName $ResourceGroupName -Force -ErrorAction $ErrorAction -Verbose

    $response
}

function Start-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Start-AzureRMVM"
    $response = Start-AzureVM  -Name $Name -ResourceGroupName $ResourceGroupName -ErrorAction $ErrorAction -Verbose

    $response
}

function Stop-AzureRMVM
{
    param([string]$Name,
          [string]$ResourceGroupName,
          [string]$ErrorAction)

    Write-Verbose -Verbose "Inside Stop-AzureRMVM"
    $response = Stop-azureVM -Name $Name -ResourceGroupName $ResourceGroupName -Force -ErrorAction $ErrorAction -Verbose

    $response
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