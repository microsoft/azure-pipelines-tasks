[CmdletBinding()]
Param()
Trace-VstsEnteringInvocation $MyInvocation

$defaultSasTokenTimeOutInHours = 4

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

# Importing required version of azure utility according to the type of service endpoint being used
$azureUtility = Get-AzureUtility $connectedServiceName
Write-Verbose -Verbose "Loading $azureUtility"
. "$PSScriptRoot\$azureUtility"

Initialize-Azure

#### MAIN EXECUTION OF AZURE FILE COPY TASK BEGINS HERE ####
try
{
    Publish-EndpointTelemetry -endpointId $connectedServiceName

    # connectionType is the endpoint auth scheme (spn | usernamepassword | certificate)
    $connectionType = Get-TypeOfConnection -connectedServiceName $connectedServiceName
    $storageKey = Get-StorageKey -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName
    $isPremiumStorage = Assert-IsStorageAccountPremium -StorageAccount $storageAccount -ConnectionType $connectionType -ConnectedServiceName $connectedServiceName
    $blobStorageEndpoint = Get-blobStorageEndpoint -storageAccountName $storageAccount -connectionType $connectionType -connectedServiceName $connectedServiceName
    Create-AzureStorageBlobContainerIfRequired -ContainerName $containerName -Destination $destination -StorageAccountName $storageAccount -StorageAccountKey $storageKey -IsPremiumStorage $isPremiumStorage
    $storageContext = Create-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey
}
catch
{
    Write-Verbose $_.Exception.ToString()
    Write-Telemetry "Task_InternalError" "TemporaryCopyingToBlobContainerFailed"
    throw
}

try {
    # Uploading files to container
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
                                             -fileCopyJobScript $AzureFileCopyRemoteJob

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
        [string] $StorageAccountKey,
        [Parameter(Mandatory = $true)]
        [bool] $IsPremiumStorage
    )
    # creating temporary container for uploading files if no input is provided for container name
    if([string]::IsNullOrEmpty($ContainerName) -or ($Destination -ne "AzureBlob"))
    {
        $ContainerName = [guid]::NewGuid().ToString()
        $storageContext = Create-AzureStorageContext -StorageAccountName $StorageAccountName  -StorageAccountKey $StorageAccountKey
        Create-AzureContainer -containerName $ContainerName -storageContext $storageContext -isPremiumStorage $IsPremiumStorage
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

function Assert-IsStorageAccountPremium {
    [CmdletBinding()]
    Param (
        [Parameter(Mandatory = $true)]
        [string] $StorageAccount,
        [Parameter(Mandatory = $true)]
        [string] $ConnectionType,
        [Parameter(Mandatory = $true)]
        [string] $ConnectedServiceName
    )
    $storageAccountType = Get-StorageAccountType -storageAccountName $StorageAccount -connectionType $ConnectionType -connectedServiceName $ConnectedServiceName
    Write-Verbose "Obtained Storage Account type: $storageAccountType"
    if (-not [string]::IsNullOrEmpty($storageAccountType) -and $storageAccountType.ToLowerInvariant().Contains('premium')) {
        $isPremiumStorage = $true
    } else {
        $isPremiumStorage = $false
    }
    return $isPremiumStorage
}