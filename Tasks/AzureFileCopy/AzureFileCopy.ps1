param (
    [string][Parameter(Mandatory=$true)]$connectedServiceName,
    [string][Parameter(Mandatory=$true)]$sourcePath,
    [string][Parameter(Mandatory=$true)]$storageAccount,
    [string][Parameter(Mandatory=$true)]$destination,
    [string]$containerName,
    [string]$blobPrefix,
    [string]$environmentName,
    [string]$resourceFilteringMethod,
    [string]$machineNames,
    [string]$vmsAdminUserName,
    [string]$vmsAdminPassword,
    [string]$targetPath,
    [string]$additionalArguments,
    [string]$cleanTargetBeforeCopy,
    [string]$copyFilesInParallel,
    [string]$skipCACheck
)

Write-Verbose "Starting Azure File Copy Task" -Verbose

Write-Verbose "connectedServiceName = $connectedServiceName" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "storageAccount = $storageAccount" -Verbose
Write-Verbose "destination type = $destination" -Verbose
Write-Verbose "containerName = $containerName" -Verbose
Write-Verbose "blobPrefix = $blobPrefix" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "vmsAdminUserName = $vmsAdminUserName" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "additionalArguments = $additionalArguments" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose
Write-Verbose "skipCACheck = $skipCACheck" -Verbose

# Constants #
$defaultSasTokenTimeOutInHours = 2
$useHttpsProtocolOption = ''
$ErrorActionPreference = 'Stop'
$telemetrySet = $false

$sourcePath = $sourcePath.Trim('"')
$storageAccount = $storageAccount.Trim()

# azcopy location on automation agent
$agentHomeDir = $env:AGENT_HOMEDIRECTORY
$azCopyLocation = Join-Path $agentHomeDir -ChildPath "Agent\Worker\Tools\AzCopy"

# Import all the dlls and modules which have cmdlets we need
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

# Load all dependent files for execution
Import-Module ./AzureFileCopyJob.ps1 -Force
Import-Module ./Utility.ps1 -Force

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingString = $env:system_debug
if ($enableDetailedLoggingString -ne "true")
{
    $enableDetailedLoggingString = "false"
}

#### MAIN EXECUTION OF AZURE FILE COPY TASK BEGINS HERE ####
try
{
    # Importing required version of azure cmdlets according to azureps installed on machine
    $azureUtility = Get-AzureUtility

    Write-Verbose -Verbose "Loading $azureUtility"
    Import-Module ./$azureUtility -Force

    # Getting connection type (Certificate/UserNamePassword/SPN) used for the task
    $connectionType = Get-ConnectionType -connectedServiceName $connectedServiceName -distributedTaskContext $distributedTaskContext

    # Getting storage key for the storage account based on the connection type
    $storageKey = Get-StorageKey -storageAccountName $storageAccount -connectionType $connectionType

    # creating storage context to be used while creating container, sas token, deleting container
    $storageContext = Create-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey

    # creating temporary container for uploading files if no input is provided for container name
    if([string]::IsNullOrEmpty($containerName))
    {
        $containerName = [guid]::NewGuid().ToString()
        Create-AzureContainer -containerName $containerName -storageContext $storageContext
    }
}
catch
{
    if(-not $telemetrySet)
    {
        Write-TaskSpecificTelemetry "UNKNOWNPREDEP_Error"
    }

    throw
}

# Uploading files to container
Upload-FilesToAzureContainer -sourcePath $sourcePath -storageAccountName $storageAccount -containerName $containerName -blobPrefix $blobPrefix -storageKey $storageKey `
                             -azCopyLocation $azCopyLocation -additionalArguments $additionalArguments -destinationType $destination

# Complete the task if destination is azure blob
if ($destination -eq "AzureBlob")
{
    Write-Verbose "Completed Azure File Copy Task for Azure Blob Destination" -Verbose
    return
}

# Copying files to Azure VMs
try
{
    # getting azure vms properties(name, fqdn, winrmhttps port)
    $azureVMResourcesProperties = Get-AzureVMResourcesProperties -resourceGroupName $environmentName -connectionType $connectionType `
    -resourceFilteringMethod $resourceFilteringMethod -machineNames $machineNames

    $skipCACheckOption = Get-SkipCACheckOption -skipCACheck $skipCACheck
    $azureVMsCredentials = Get-AzureVMsCredentials -vmsAdminUserName $vmsAdminUserName -vmsAdminPassword $vmsAdminPassword

    # generate container sas token with full permissions
    $containerSasToken = Generate-AzureStorageContainerSASToken -containerName $containerName -storageContext $storageContext -tokenTimeOutInHours $defaultSasTokenTimeOutInHours

    #copies files on azureVMs 
    Copy-FilesToAzureVMsFromStorageContainer `
        -storageAccountName $storageAccount -containerName $containerName -containerSasToken $containerSasToken -targetPath $targetPath -azCopyLocation $azCopyLocation `
        -resourceGroupName $environmentName -azureVMResourcesProperties $azureVMResourcesProperties -azureVMsCredentials $azureVMsCredentials `
        -cleanTargetBeforeCopy $cleanTargetBeforeCopy -communicationProtocol $useHttpsProtocolOption -skipCACheckOption $skipCACheckOption `
        -enableDetailedLoggingString $enableDetailedLoggingString -additionalArguments $additionalArguments -copyFilesInParallel $copyFilesInParallel
}
catch
{
    Write-Verbose $_.Exception.ToString() -Verbose

    Write-TaskSpecificTelemetry "UNKNOWNDEP_Error"
    throw
}
finally
{
    Remove-AzureContainer -containerName $containerName -storageContext $storageContext
    Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
}