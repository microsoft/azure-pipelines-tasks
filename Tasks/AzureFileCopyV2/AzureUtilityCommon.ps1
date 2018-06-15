function Create-AzureStorageContext
{
    param([string]$storageAccountName,
          [string]$storageAccountKey)

    if(-not [string]::IsNullOrEmpty($storageAccountName) -and -not [string]::IsNullOrEmpty($storageAccountKey))
    {
        Write-Verbose "[Azure Call]Creating AzureStorageContext for storage account: $storageAccountName"
        $storageContext = New-AzureStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey -ErrorAction Stop
        Write-Verbose "[Azure Call]Created AzureStorageContext for storage account: $storageAccountName"

        return $storageContext
    }
}

function Generate-AzureStorageContainerSASToken {
    Param (
        [Parameter(Mandatory = $true)]
        [string] $ContainerName,
        [Parameter(Mandatory = $true)]
        [string] $StorageAccountName,
        [Parameter(Mandatory = $true)]
        [string] $StorageAccountKey,
        [string] $Permission = "r",
        [int] $SASTokenTimeoutInHrs = 4
    )
    $storageContext = Create-AzureStorageContext -StorageAccountName $StorageAccountName  -StorageAccountKey $StorageAccountKey
    Write-Verbose "[Azure Call]Generating SasToken for container: $ContainerName in storage: $StorageAccountName with expiry time: $SASTokenTimeoutInHrs hours"
    $storageContainerSaSToken = New-AzureStorageContainerSASToken -Name $ContainerName -Context $storageContext -Permission $Permission -ExpiryTime (Get-Date).AddHours($SASTokenTimeoutInHrs)
    Write-Verbose "[Azure Call]Generated SasToken: $storageContainerSaSToken successfully for container: $ContainerName in storage: $StorageAccountName"
    return $storageContainerSaSToken
}