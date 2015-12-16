# Create ResourceGroup with name $resourceGroupName at $location if it is not already present.
function Create-AzureResourceGroupIfNotExist
{
    param([string]$resourceGroupName,
          [string]$location)
}

# Deploy $csmFile template on ResourceGroup $resourceGroupName.
# Return  hash with following format: @{"azureResourceGroupDeployment" = $($azureResourceGroupDeployment); "deploymentError" = $($deploymentError)}
# Where $azureResourceGroupDeployment is deploymentResponse and $deploymentError is deployment error.	
function Deploy-AzureResourceGroup
{
    param([string]$csmFile,
        [System.Collections.Hashtable]$csmParametersObject,
        [string]$resourceGroupName,
        [string]$overrideParameters)
}

# Return instanceView of all VMs in ResourceGroup $resourceGroupName.
# Return type is a hash with key = VMName, Value = InstanceView_of_VM
function Get-AllVmInstanceView
{
    param([string]$resourceGroupName)
}

# Start the VM $machineName in ResourceGroup $resourceGroupName
function Start-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)
}

# Stop the VM $machineName in ResourceGroup $resourceGroupName
function Stop-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)
}

# Delete the VM $machineName in ResourceGroup $resourceGroupName
function Delete-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

}

# Start the ResourceGroup $resourceGroupName
function Delete-ResourceGroup
{
    param([string]$resourceGroupName)
}

# Returns all RM VM Resources in ResourceGroup $resourceGroupName
function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)
}

# Returns All Details related to RG Resources which will be used to get connection information for RM VMs
# Return type is hash table in following format:
# @{"networkInterfaceResources" = networkInterfaceResources; "publicIPAddressResources" = publicIPAddressResources; "loadBalancerResources" = LoadBalancerDetails}
# Where LoadBalancerDetails is hash table in following format: @{"frontEndIPConfigs" = frontEndIPConfigs; "inboundRules" = inboundRules}
function Get-AzureRMResourceGroupResourcesDetails
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources)
}

# Returns all classic VM Resources in ResourceGroup $resourceGroupName
function Get-AzureClassicVMsInResourceGroup
{
    param([string]$resourceGroupName)
}

# Return Details of all Classic VMs in ResourceGroup $resourceGroupName
# Return type is hash table with key = VMName, Value = resourceProperties
# Where resourceProperties = @{"Name" = resourceName; "fqdn" = resourceFQDN; "winRMHttpsPort" = resourceWinRmHttpsPort}
function Get-AzureClassicVMsConnectionDetailsInResourceGroup
{
    param([string]$resourceGroupName,
          [object]$azureClassicVMResources)
}