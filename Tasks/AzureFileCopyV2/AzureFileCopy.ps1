[CmdletBinding()]
Param()
Trace-VstsEnteringInvocation $MyInvocation

# Import required modules
Import-Module "$PSScriptRoot\ps_modules\RemoteDeployer"
Import-Module "$PSScriptRoot\ps_modules\VstsAzureHelpers_"
Import-Module "$PSScriptRoot\ps_modules\TelemetryHelper"
Import-VstsLocStrings -LiteralPath "$PSScriptRoot\Task.json"

# dot source required files into current context
. "$PSScriptRoot\AzureFileCopyRemoteJob.ps1"
. "$PSScriptRoot\Utility.ps1"

$connectedServiceNameSelector = Get-VstsInput -Name ConnectedServiceNameSelector -Require

if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM") {
    $connectedServiceName = Get-VstsInput -Name ConnectedServiceNameARM
    $storageAccount = Get-VstsInput -Name StorageAccountRM
} else {
    $connectedServiceName = Get-VstsInput -Name ConnectedServiceName
    $storageAccount = Get-VstsInput -Name StorageAccount
}
$storageAccount = $storageAccount.Trim()

$containerName = Get-VstsInput -Name ContainerName
$containerName = $containerName.Trim().ToLowerInvariant()

$destination = Get-VstsInput -Name Destination -Require

# Importing required version of azure utility according to the type of service endpoint being used
$azureUtility = Get-AzureUtility $connectedServiceName
Write-Verbose -Verbose "Loading $azureUtility"
. "$PSScriptRoot\$azureUtility"

Initialize-Azure

#### MAIN EXECUTION OF AZURE FILE COPY TASK BEGINS HERE ####
try {
    Publish-EndpointTelemetry -endpointId $connectedServiceName

    # connectionType is the endpoint auth scheme (spn | usernamepassword | certificate)
    $connectionType = Get-TypeOfConnection -connectedServiceName $connectedServiceName
    $isPremiumStorage = Assert-IsStorageAccountPremium -StorageAccountName $storageAccount -ConnectionType $connectionType -ConnectedServiceName $connectedServiceName
    $blobStorageEndpoint = Get-blobStorageEndpoint -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName
    $storageKey = Get-StorageKey -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName
    Create-AzureStorageBlobContainerIfRequired -ContainerName $containerName -Destination $destination -StorageAccountName $storageAccount -StorageAccountKey $storageKey -IsPremiumStorage $isPremiumStorage
    $storageContext = Create-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey
} catch {
    Write-Verbose $_.Exception.ToString()
    Write-Telemetry "Task_InternalError" "TemporaryCopyingToBlobContainerFailed"
    throw
}

try {
    # Uploading files to container
    $sourcePath = Get-VstsInput -Name SourcePath -Require
    $sourcePath = $sourcePath.Trim('"')
    if ($destination -eq "AzureBlob") {
        $blobPrefix = Get-VstsInput -Name BlobPrefix
    }
    $additionalArgumentsForBlobCopy = Get-ArgsForBlobCopy -ContainerName $containerName -IsPremiumStorage $isPremiumStorage
    $azCopyLocation = Get-AzCopyLocation
    Upload-FilesToAzureContainer -sourcePath $sourcePath `
                                 -storageAccountName $storageAccount `
                                 -containerName $containerName `
                                 -blobPrefix $blobPrefix `
                                 -blobStorageEndpoint $blobStorageEndpoint `
                                 -storageKey $storageKey `
                                 -azCopyLocation $azCopyLocation `
                                 -additionalArguments $additionalArgumentsForBlobCopy

    # Complete the task if destination is azure blob
    if ($destination -eq "AzureBlob") {
        Set-OutputVariables -ContainerName $containerName -StorageAccountName $storageAccount -StorageAccountKey $storageKey
        Write-Verbose "Completed Azure File Copy Task for Azure Blob Destination"
        return
    }
} catch {
    # deletes container only if we have created temporary container
    if ($destinationType -ne "AzureBlob") {
        Remove-AzureContainer -containerName $containerName -storageContext $storageContext
    }
    throw
}

# Copying files to Azure VMs
try {
    $resourceFilteringMethod = Get-VstsInput -Name ResourceFilteringMethod
    $machineNames = Get-VstsInput -Name MachineNames
    $targetPath = Get-VstsInput -Name TargetPath
    $additionalArgumentsForVMCopy = Get-VstsInput -Name AdditionalArgumentsForVMCopy
    $cleanTargetBeforeCopy = Get-VstsInput -Name CleanTargetBeforeCopy -AsBool
    $copyFilesInParallel = Get-VstsInput -Name CopyFilesInParallel -AsBool
    $skipCACheck = Get-VstsInput -Name SkipCACheck -AsBool
    $enableCopyPrerequisites = Get-VstsInput -Name EnableCopyPrerequisites -AsBool
    
    if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM") {
        $environmentName = Get-VstsInput -Name EnvironmentNameRM
    } else {
        $environmentName = Get-VstsInput -Name EnvironmentName
    }
    
    # getting azure vms properties(name, fqdn, winrmhttps port)
    $azureVMResourcesProperties = Get-AzureVMResourcesProperties -resourceGroupName $environmentName `
                                                                 -connectionType $connectionType `
                                                                 -resourceFilteringMethod $resourceFilteringMethod `
                                                                 -machineNames $machineNames `
                                                                 -enableCopyPrerequisites $enableCopyPrerequisites `
                                                                 -connectedServiceName $connectedServiceName
    
    $vmsAdminUserName = Get-VstsInput -Name VmsAdminUsername
    $vmsAdminPassword = Get-VstsInput -Name VmsAdminPassword
    $azureVMsCredentials = Get-AzureVMsCredentials -vmsAdminUserName $vmsAdminUserName -vmsAdminPassword $vmsAdminPassword

    # Get Invoke-RemoteScript parameters
    $invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMResourcesProperties -networkCredentials $azureVMsCredentials -skipCACheck $skipCACheck

    # generate container sas token with full permissions
    $containerSasToken = Generate-AzureStorageContainerSASToken -ContainerName $containerName -StorageAccountName $storageAccount -StorageAccountKey $storageKey -Permission 'rwdl'

    # Copies files on azureVMs 
    $azCopyLocation = Get-AzCopyLocation -Parent
    Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames `
                                             -credential $invokeRemoteScriptParams.credential `
                                             -protocol $invokeRemoteScriptParams.protocol `
                                             -sessionOption $invokeRemoteScriptParams.sessionOption `
                                             -blobStorageEndpoint $blobStorageEndpoint `
                                             -containerName $containerName `
                                             -containerSasToken $containerSasToken `
                                             -targetPath $targetPath `
                                             -cleanTargetBeforeCopy $cleanTargetBeforeCopy `
                                             -copyFilesInParallel $copyFilesInParallel `
                                             -additionalArguments $additionalArgumentsForVMCopy `
                                             -azCopyToolLocation $azCopyLocation `
                                             -fileCopyJobScript $AzureFileCopyRemoteJob

    Write-Output (Get-VstsLocString -Key "AFC_CopySuccessful" -ArgumentList $sourcePath, $environmentName)
} catch {
    Write-Verbose $_.Exception.ToString()
    Write-Telemetry "Task_InternalError" "CopyingToAzureVMFailed"
    throw
} finally { 
    Remove-AzureContainer -containerName $containerName -storageContext $storageContext
    Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
}