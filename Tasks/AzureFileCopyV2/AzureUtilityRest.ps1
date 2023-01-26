. "$PSScriptRoot/AzureUtilityGTE1.1.0.ps1"
Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_

function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Write-Verbose "[Azure Call](RDFE)Retrieving storage key for the storage account: $storageAccountName"
        $storageKeyDetails = Get-AzStorageKeys $storageAccountName $endpoint -ErrorAction Stop
        $storageKey = $storageKeyDetails.Primary
        Write-Verbose "[Azure Call](RDFE)Retrieved storage key successfully for the storage account: $storageAccountName"

        return $storageKey
    }
}

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName,
          [object]$serviceEndpoint)

    if (-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName"
        
        $storageKeyDetails = Get-AzRMStorageKeys $azureResourceGroupName $storageAccountName $serviceEndpoint
        $storageKey = $storageKeyDetails.Key1
        Write-Verbose "[Azure Call]Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName"

        return $storageKey
    }
}

function Get-AzureBlobStorageEndpointFromRDFE
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Write-Verbose "[Azure Call](RDFE)Retrieving storage account endpoint for the storage account: $storageAccount"
        $storageAccountInfo = Get-AzStorageAccount $storageAccountName $endpoint -ErrorAction Stop
        $storageAccountEnpoint = $null
        if (($storageAccountInfo -ne $null) -and ($storageAccountInfo.Endpoints -ne $null) -and ($storageAccountInfo.Endpoints.Endpoint -ne $null))
        {
            $storageAccountEnpoint = @($storageAccountInfo.Endpoints.Endpoint)[0]
        }
        Write-Verbose "[Azure Call](RDFE)Retrieved storage account endpoint successfully for the storage account: $storageAccount"

        return $storageAccountEnpoint
    }
}

function Get-AzureBlobStorageEndpointFromARM
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage account endpoint for the storage account: $storageAccount in resource group: $azureResourceGroupName"
        
        $storageAccountInfo = Get-AzRMStorageAccount $azureResourceGroupName $storageAccountName $endpoint -ErrorAction Stop
        $storageAccountEnpoint = $storageAccountInfo.PrimaryEndpoints[0].blob
        Write-Verbose "[Azure Call]Retrieved storage account endpoint successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName"

        return $storageAccountEnpoint
    }          
}

function Get-AzureStorageAccountTypeFromRDFE
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        Write-Verbose "[Azure Call](RDFE)Retrieving storage account type for the storage account: $storageAccount"
        $storageAccountInfo = Get-AzStorageAccount $storageAccountName $endpoint -ErrorAction Stop
        $storageAccountType = $storageAccountInfo.AccountType
        Write-Verbose "[Azure Call](RDFE)Retrieved storage account type successfully for the storage account: $storageAccount"

        return $storageAccountType
    }
}

function Get-AzureStorageAccountTypeFromARM
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        # get azure storage account resource group name
        $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

        Write-Verbose "[Azure Call]Retrieving storage account type for the storage account: $storageAccount in resource group: $azureResourceGroupName"
        $storageAccountInfo = Get-AzRMStorageAccount $azureResourceGroupName $storageAccountName $endpoint -ErrorAction Stop
        $storageAccountType = $storageAccountInfo.sku.tier
                    Write-Verbose "[Azure Call]Retrieved storage account type successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName"

        return $storageAccountType
    }          
}

function Get-AzureMachineCustomScriptExtension
{
   param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
    {
        Write-Host (Get-VstsLocString -Key "AFC_GetCustomScriptExtension" -ArgumentList $name, $vmName)
        $customScriptExtension = Get-AzRmVmCustomScriptExtension $resourceGroupName $vmName $name $endpoint  
        Write-Host (Get-VstsLocString -Key "AFC_GetCustomScriptExtensionComplete" -ArgumentList $name, $vmName)
    }
                
    return $customScriptExtension
}

function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-VstsLocString -Key "AFC_RemoveCustomScriptExtension" -ArgumentList $name, $vmName)
        $response = Remove-AzRmVMCustomScriptExtension $resourceGroupName $vmName $name $endpoint        
        Write-Host (Get-VstsLocString -Key "AFC_RemoveCustomScriptExtensionComplete" -ArgumentList $name, $vmName)
    }

    return $response
}