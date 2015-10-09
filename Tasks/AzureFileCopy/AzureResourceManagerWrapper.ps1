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

function New-AzureRMStorageContext
{
    param([string]$StorageAccountName,
          [string]$StorageAccountKey)
	
	Write-Verbose "inside AzureRMStorageContext." -Verbose
    $storageContext = New-AzureStorageContext -StorageAccountName $StorageAccountName -StorageAccountKey $StorageAccountKey
	return $storageContext
}

function New-AzureRMStorageContainer
{
    param([string]$Name,
          [Microsoft.WindowsAzure.Commands.Common.Storage.AzureStorageContext]$Context,
		  [string]$Permission)
		  
    $storageContainer = New-AzureStorageContainer -Name $Name -Context $Context -Permission $Permission
	return $storageContainer
}

function Remove-AzureRMStorageContainer
{
    param([string]$Name,
          [Microsoft.WindowsAzure.Commands.Common.Storage.AzureStorageContext]$Context,
		  [string]$ErrorAction)
		  
    Remove-AzureStorageContainer -Name $Name -Context $Context -Force -ErrorAction $ErrorAction
}

function New-AzureRMStorageContainerSASToken
{
    param([string]$Name,
          [Microsoft.WindowsAzure.Commands.Common.Storage.AzureStorageContext]$Context,
		  [DateTime]$ExpiryTime,
		  [string]$Permission)
		  
    $sasToken = New-AzureStorageContainerSASToken -Name $Name -ExpiryTime $ExpiryTime -Context $Context -Permission $Permission
	return $sasToken
}
