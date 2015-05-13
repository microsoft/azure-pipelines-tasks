param (
    [string]$connectedServiceName,
    [string]$sourcePath, 
    [string]$storageAccount,
    [string]$containerName,
    [string]$blobPrefix
    )

Write-Verbose "Entering script CopyFilesToAzureBlob.ps1" -Verbose

Write-Verbose "connectedServiceName = $connectedServiceName" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "storageAccount = $storageAccount" -Verbose
Write-Verbose "containerName = $containerName" -Verbose
Write-Verbose "blobPrefix = $blobPrefix" -Verbose

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$agentHomeDir = $env:AGENT_HOMEDIRECTORY
$azCopyLocation = Join-Path $agentHomeDir  -ChildPath "Agent\Worker\Tools"

$storageKeyDetails = Get-AzureStorageKey -StorageAccountName $storageAccount
$storageKey = $storageKeyDetails.Primary

$copyResponse = Copy-FilesToAzureBlob -SourcePathLocation $sourcePath -StorageAccountName $storageAccount -ContainerName $containerName -BlobPrefix $blobPrefix -StorageAccountKey $storageKey -AzCopyLocation $azCopyLocation

$status = $copyResponse.Status
$log = $copyResponse.Log

Write-Output (Get-LocalizedString -Key 'Copy Status to blob : {0}' -ArgumentList $status)
Write-Verbose "Logs for upload to blob : $log" -Verbose

if($copyResponse.Status -ne "Succeeded")
{
     $error = $copyResponse.Error
     throw (Get-LocalizedString -Key 'Upload to blob failed. {0}' -ArgumentList $error)
}

Write-Verbose "Leaving script CopyFilesToAzureBlob.ps1" -Verbose