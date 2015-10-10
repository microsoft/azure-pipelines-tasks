function Get-AzureRMResource
{
    param([string]$ResourceName)

	Write-Verbose -Verbose "Inside Get-AzureRMResource"
    $azureResource = Get-AzureResource -ResourceName $ResourceName
    return $azureResource
}

function Get-AzureRMStorageAccountKey
{
    param([string]$ResourceGroupName,
          [string]$Name)
		  
    Write-Verbose -Verbose "Inside Get-AzureRMStorageAccountKey"	
    $storageKey = Get-AzureStorageAccountKey -ResourceGroupName $ResourceGroupName -Name $Name
	return $storageKey
}