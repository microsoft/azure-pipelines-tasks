[CmdletBinding()]
Param()
Trace-VstsEnteringInvocation $MyInvocation

# Import required modules
Import-Module $PSScriptRoot\ps_modules\RemoteDeployer
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Import-Module $PSScriptRoot\ps_modules\TelemetryHelper

# Constants
$defaultSasTokenTimeOutInHours = 4
$isPremiumStorage = $false

$ErrorActionPreference = 'Stop'
# Get inputs for the task
$connectedServiceNameSelector = Get-VstsInput -Name ConnectedServiceNameSelector -Require

if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM") {
    $connectedServiceName = Get-VstsInput -Name ConnectedServiceNameARM
    $storageAccount = Get-VstsInput -Name StorageAccountRM
} else {
    $connectedServiceName = Get-VstsInput -Name ConnectedServiceName
    $storageAccount = Get-VstsInput -Name StorageAccount
}
$storageAccount = $storageAccount.Trim()

# Importing required version of azure cmdlets according to azureps installed on machine
$azureUtility = Get-AzureUtility $connectedServiceName
Write-Verbose -Verbose "Loading $azureUtility"
. "$PSScriptRoot/$azureUtility"

$sourcePath = Get-VstsInput -Name SourcePath -Require
$sourcePath = $sourcePath.Trim('"')

$containerName = Get-VstsInput -Name ContainerName
$containerName = $containerName.Trim().ToLowerInvariant()

$destination = Get-VstsInput -Name Destination -Require
if ($destination -eq "AzureBlob") {
    $blobPrefix = Get-VstsInput -Name BlobPrefix
}

$outputStorageContainerSasToken = Get-VstsInput -Name OutputStorageContainerSasToken
$outputStorageURI = Get-VstsInput -Name OutputStorageUri

Initialize-Azure

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

# Load all dependent files for execution
. "$PSScriptRoot\AzureFileCopyRemoteJob.ps1"
. "$PSScriptRoot\Utility.ps1"

# Enabling detailed logging only when system.debug is true
$enableDetailedLogging = ($env:system_debug -eq "true")

# Telemetry


#### MAIN EXECUTION OF AZURE FILE COPY TASK BEGINS HERE ####
try
{
    Publish-EndpointTelemetry -endpointId $connectedServiceName

    # Getting connection type (Certificate/UserNamePassword/SPN) used for the task
    $connectionType = Get-TypeOfConnection -connectedServiceName $connectedServiceName

    # Getting storage key for the storage account based on the connection type
    $storageKey = Get-StorageKey -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName

    # creating storage context to be used while creating container, sas token, deleting container
    $storageContext = Create-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey
	
    # Geting Azure Storage Account type
    $storageAccountType = Get-StorageAccountType -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName
    Write-Verbose "Obtained Storage Account type: $storageAccountType"
    if(-not [string]::IsNullOrEmpty($storageAccountType) -and $storageAccountType.Contains('Premium'))
    {
        $isPremiumStorage = $true
    }


	
    # Getting Azure Blob Storage Endpoint
    $blobStorageEndpoint = Get-blobStorageEndpoint -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName

}
catch
{
    Write-Verbose $_.Exception.ToString()
    Write-Telemetry "Task_InternalError" "TemporaryCopyingToBlobContainerFailed"
    throw
}

# Set optional arguments for azcopy blob upload
<#if ($useDefaultArgumentsForBlobCopy)
{
    # Adding default optional arguments:
    # /XO: Excludes an older source resource
    # /Y: Suppresses all AzCopy confirmation prompts
    # /SetContentType: Sets each blob's MIME type according to its file extension
    # /Z: Journal file location
    # /V: AzCopy verbose logs file location

    Write-Verbose "Using default AzCopy arguments for uploading to blob storage"

    $logFileName = "AzCopyVerbose_" + [guid]::NewGuid() + ".log"
    $logFilePath = Join-Path -Path $azCopyLocation -ChildPath $logFileName

    $additionalArgumentsForBlobCopy = "/XO /Y /SetContentType /Z:`"$azCopyLocation`" /V:`"$logFilePath`""

    # Add more arguments if required

    # Premium storage accounts only support page blobs
    if($isPremiumStorage)
    {
        Write-Verbose "Setting BlobType to page for Premium Storage account."
        $additionalArgumentsForBlobCopy += " /BlobType:page"
    }

    # $root container does not support sub folders. So excluding recursive copy option for $root container.
    if($containerName -ne '$root')
    {
        Write-Verbose "Adding argument for recursive copy"
        $additionalArgumentsForBlobCopy += " /S"
    }
} #>

#Check-ContainerNameAndArgs -containerName $containerName -additionalArguments $additionalArgumentsForBlobCopy
try {
    $additionalArgumentsForBlobCopy = Get-ArgsForBlobCopy -ContainerName $containerName -IsPremiumStorage $isPremiumStorage
    # Uploading files to container
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
        # Get URI and SaSToken for output if needed
        if(-not [string]::IsNullOrEmpty($outputStorageURI)) {
            $storageAccountContainerURI = $storageContext.BlobEndPoint + $containerName
            Write-Host "##vso[task.setvariable variable=$outputStorageURI;]$storageAccountContainerURI"
        }
        if(-not [string]::IsNullOrEmpty($outputStorageContainerSASToken)) {
            $storageContainerSaSToken = New-AzureStorageContainerSASToken -Container $containerName -Context $storageContext -Permission r -ExpiryTime (Get-Date).AddHours($defaultSasTokenTimeOutInHours)
            Write-Host "##vso[task.setvariable variable=$outputStorageContainerSASToken;]$storageContainerSasToken"
        }
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
try
{
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
    $azureVMResourcesProperties = Get-AzureVMResourcesProperties -resourceGroupName $environmentName -connectionType $connectionType `
    -resourceFilteringMethod $resourceFilteringMethod -machineNames $machineNames -enableCopyPrerequisites $enableCopyPrerequisites -connectedServiceName $connectedServiceName
    
    $vmsAdminUserName = Get-VstsInput -Name VmsAdminUsername
    $vmsAdminPassword = Get-VstsInput -Name VmsAdminPassword
    $azureVMsCredentials = Get-AzureVMsCredentials -vmsAdminUserName $vmsAdminUserName -vmsAdminPassword $vmsAdminPassword

    # Get Invoke-RemoteScript parameters
    $invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMResourcesProperties `
                                                                 -networkCredentials $azureVMsCredentials `
                                                                 -skipCACheck $skipCACheck

    # generate container sas token with full permissions
    $containerSasToken = Generate-AzureStorageContainerSASToken -containerName $containerName -storageContext $storageContext -tokenTimeOutInHours $defaultSasTokenTimeOutInHours

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
                                             -fileCopyJobScript $AzureFileCopyRemoteJob `
                                             -enableDetailedLogging $enableDetailedLogging

    Write-Output (Get-VstsLocString -Key "AFC_CopySuccessful" -ArgumentList $sourcePath, $environmentName)
}
catch
{
    Write-Verbose $_.Exception.ToString()

    Write-Telemetry "Task_InternalError" "CopyingToAzureVMFailed"
    throw
}
finally
{
    Remove-AzureContainer -containerName $containerName -storageContext $storageContext
    Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
    Trace-VstsLeavingInvocation $MyInvocation
}

function Get-AzCopyLocation {
    [CmdletBinding()]
    Param (
        [switch] $Parent
    )
    $azCopyRelativeLocation = "AzCopy\AzCopy.exe"
    $azCopyFileLocation = [System.IO.Path]::Combine($PSScriptRoot, $azCopyRelativeLocation)
    if ($Parent) {
        return (Split-Path -Path $azCopyFileLocation -Parent).ToString()
    }
    return ($azCopyFileLocation.ToString())
}

function Get-AzCopyJournalFileLocation {
    return (Get-AzCopyLocation)
}

function Get-AzCopyLogFile {
    $logfile = Join-Path -Path $(Get-VstsTaskVariable -Name 'Agent.TempDirectory') -ChildPath "AzCopyVerbose.log"
    return ($logfile.ToString())
}

function Get-ArgsForBlobCopy {
    [CmdletBinding()]
    Param (
        [string] $ContainerName,
        [bool] $IsPremiumStorage
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $azCopyArgs = Get-VstsInput -Name AdditionalArgumentsForBlobCopy
        if (([string]::IsNullOrEmpty($azCopyArgs)) -or ($azCopyArgs.Trim() -eq [string]::Empty)) {
            $azCopyArgs = ""
            
            # Adding default optional arguments:
            # /XO: Excludes an older source resource
            # /Y: Suppresses all AzCopy confirmation prompts
            # /SetContentType: Sets each blob's MIME type according to its file extension
    
            $azCopyArgs += " /XO /Y /SetContentType"
    
            # Premium storage accounts only support page blobs
            if($IsPremiumStorage) {
                $azCopyArgs += " /BlobType:page"
            }
    
            # $root container does not support sub folders. So excluding recursive copy option for $root container.
            if($ContainerName.ToLowerInvariant() -ne '$root') {
                $azCopyArgs += " /S"
            }
    
            # /Z: Journal file location
            $azCopyArgs += " /Z:'$(Get-AzCopyJournalFileLocation)'"
        }
        
        if(($ContainerName.ToLowerInvariant() -eq '$root') -and ($azCopyArgs.ToUpperInvariant() -like '* /S *')) {
            Write-Warning (Get-VstsLocString -Key "AFC_RootContainerAndDirectory")
        }

        Write-Verbose "AzCopy arguments for blob copy:'$azCopyArgs'"
        return $azCopyArgs
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Create-AzureStorageBlobContainerIfRequired {
    [CmdletBinding()]
    Param (
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $ContainerName,
        [Parameter(Mandatory = $true)]
        [string] $Destination,
        [Parameter(Mandatory = $true)]
        [string] $StorageAccountName,
        [Parameter(Mandatory = $true)]
        [string] $StorageAccountKey
    )
    # creating temporary container for uploading files if no input is provided for container name
    if([string]::IsNullOrEmpty($ContainerName) -or ($Destination -ne "AzureBlob"))
    {
        $ContainerName = [guid]::NewGuid().ToString()
        $storageContext = Create-AzureStorageContext -StorageAccountName $StorageAccountName  -StorageAccountKey $StorageAccountKey
        Create-AzureContainer -containerName $ContainerName -storageContext $storageContext -isPremiumStorage $isPremiumStorage
    }
}

function Publish-EndpointTelemetry {
    [CmdletBinding()]
    Param(
        [string] $endpointId
    )
    
    $telemetry = @{
        "endpointId" = $endpointId;
    }
    $telemetryJson = ConvertTo-Json -InputObject $telemetry -Compress
    Write-Host "##vso[telemetry.publish area=TaskEndpointId;feature=AzureFileCopy]$telemetryJson"
}