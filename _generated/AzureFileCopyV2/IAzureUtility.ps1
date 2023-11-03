# This file implements IAzureUtility for Azure PowerShell version >= 1.0.0

# return storageKey from storageAccount if present in classic, else throws
function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName,
          [object]$endpoint)
}

# return azureresourcegroup name for storageaccount present in RM, if not present throws
function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)
}

# return storageKey from storageAccount if present in RM, else throws
function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName,
        [object]$endpoint,
        [string][Parameter(Mandatory=$false)]$connectedServiceNameARM,
        [string][Parameter(Mandatory=$false)]$vstsAccessToken)
}

# creates azureStorageContext object for given storageaccount and storagekey
# used in doing operations over storage
function Create-AzureStorageContext
{
    param([string]$storageAccountName,
          [string]$storageAccountKey)
}

# return blob storage endpoint for given classic storage account
function Get-AzureBlobStorageEndpointFromRDFE
{
    param([string]$storageAccountName,
          [object]$endpoint)
}

# return blob storage endpoint for given ARM storage account
function Get-AzureBlobStorageEndpointFromARM
{
    param([string]$storageAccountName,
        [object]$endpoint,
        [string]$connectedServiceNameARM,
        [string]$vstsAccessToken)
}

# return account type for given ARM storage account
function Get-AzureStorageAccountTypeFromARM
{
    param([string]$storageAccountName,
        [object]$endpoint,
        [string]$connectedServiceNameARM,
        [string]$vstsAccessToken)
}

# return account type for given classic storage account
function Get-AzureStorageAccountTypeFromRDFE
{
    param([string]$storageAccountName,
          [object]$endpoint)
}

#creates azure container on given storageaccount whose information is present in $storageContext
function Create-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext,
          [boolean]$isPremiumStorage)
}

# deletes azure container from storageaccount whose information is present in $storageContext
function Remove-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext)
}

# Gets cloud service if present, else throws
function Get-AzureCloudService
{
    param([string]$cloudServiceName)
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

#Generate and return SAS Token corresponding to Container and storageaccount information present in $storageContext
function Generate-AzureStorageContainerSASToken
{
    param([string]$containerName,
          [object]$storageContext,
          [System.Int32]$tokenTimeOutInHours)
}

# Returns the status of vm $name in ResourceGroup $resourceGroupName
function Get-AzureMachineStatus
{
    param([string]$resourceGroupName,
          [string]$name)
}

# Returns details of the custom script extension $name of VM $vmName present in ResourceGroup $resourceGroupName
function Get-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
        [string]$vmName,
        [string]$name,
        [object]$endpoint,
        [string]$connectedServiceNameARM,
        [string]$vstsAccessToken)
}

# Returns details of the custom script extension $name executed on VM $vmName present in ResourceGroup $resourceGroupName
function Set-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [string[]]$fileUri,
          [string]$run,
          [string]$argument,
          [string]$location)
}

# Returns details of the custom script extension $name deleted from VM $vmName present in ResourceGroup $resourceGroupName
function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
        [string]$vmName,
        [string]$name,
        [object]$endpoint,
        [string]$connectedServiceNameARM,
        [string]$vstsAccessToken)
}