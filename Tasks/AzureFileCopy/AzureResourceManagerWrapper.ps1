function Get-AzureRMResource
{
    param([string]$ResourceName)

    $azureResource = Get-AzureResource -ResourceName $ResourceName
    return $azureResource
}

function Get-AzureRMStorageAccountKey
{
    param([string]$ResourceGroupName,
          [string]$Name)
		  
    $storageKey = Get-AzureStorageAccountKey -ResourceGroupName $ResourceGroupName -Name $Name
	return $storageKey
}