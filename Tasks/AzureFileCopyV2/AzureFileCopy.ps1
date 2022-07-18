[CmdletBinding()]
param()

# Some Changes

Trace-VstsEnteringInvocation $MyInvocation

# Get inputs for the task
$connectedServiceNameSelector = Get-VstsInput -Name ConnectedServiceNameSelector -Require
$sourcePath = Get-VstsInput -Name SourcePath -Require
$destination = Get-VstsInput -Name Destination -Require
$connectedServiceName = Get-VstsInput -Name ConnectedServiceName
$connectedServiceNameARM = Get-VstsInput -Name ConnectedServiceNameARM
$storageAccount = Get-VstsInput -Name StorageAccount
$storageAccountRM = Get-VstsInput -Name StorageAccountRM
$containerName = Get-VstsInput -Name ContainerName
$blobPrefix = Get-VstsInput -Name BlobPrefix
$environmentName = Get-VstsInput -Name EnvironmentName
$environmentNameRM = Get-VstsInput -Name EnvironmentNameRM
$resourceFilteringMethod = Get-VstsInput -Name ResourceFilteringMethod
$machineNames = Get-VstsInput -Name MachineNames
$vmsAdminUserName = Get-VstsInput -Name VmsAdminUsername
$vmsAdminPassword = Get-VstsInput -Name VmsAdminPassword
$targetPath = Get-VstsInput -Name TargetPath
$additionalArgumentsForBlobCopy = Get-VstsInput -Name AdditionalArgumentsForBlobCopy
$additionalArgumentsForVMCopy = Get-VstsInput -Name AdditionalArgumentsForVMCopy
$cleanTargetBeforeCopy = Get-VstsInput -Name CleanTargetBeforeCopy -AsBool
$copyFilesInParallel = Get-VstsInput -Name CopyFilesInParallel -AsBool
$skipCACheck = Get-VstsInput -Name SkipCACheck -AsBool
$enableCopyPrerequisites = Get-VstsInput -Name EnableCopyPrerequisites -AsBool
$outputStorageContainerSasToken = Get-VstsInput -Name OutputStorageContainerSasToken
$outputStorageURI = Get-VstsInput -Name OutputStorageUri

if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM")
{
    $connectedServiceName = $connectedServiceNameARM
    $storageAccount = $storageAccountRM
    $environmentName = $environmentNameRM
}

if ($destination -ne "AzureBlob")
{
    $blobPrefix = ""
}

# Constants
$defaultSasTokenTimeOutInHours = 4
$useHttpsProtocolOption = ''
$ErrorActionPreference = 'Stop'
$telemetrySet = $false
$isPremiumStorage = $false

$sourcePath = $sourcePath.Trim('"')
$storageAccount = $storageAccount.Trim()
$containerName = $containerName.Trim().ToLower()

$additionalArgumentsForBlobCopy = $additionalArgumentsForBlobCopy.Trim()
$additionalArgumentsForVMCopy = $additionalArgumentsForVMCopy.Trim()
$useDefaultArgumentsForBlobCopy = ($additionalArgumentsForBlobCopy -eq "")

# azcopy location on automation agent
$azCopyExeLocation = 'AzCopy\AzCopy.exe'
$azCopyLocation = [System.IO.Path]::GetDirectoryName($azCopyExeLocation)

# Import RemoteDeployer
Import-Module $PSScriptRoot\ps_modules\RemoteDeployer

# Initialize Azure.
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
. "$PSScriptRoot\Utility.ps1"
$endpoint = Get-Endpoint -connectedServiceName $connectedServiceName
Update-PSModulePathForHostedAgentWithLatestModule -Endpoint $endpoint
Initialize-Azure

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

# Load all dependent files for execution
. "$PSScriptRoot\AzureFileCopyRemoteJob.ps1"

# Enabling detailed logging only when system.debug is true
$enableDetailedLogging = ($env:system_debug -eq "true")

# Telemetry
Import-Module $PSScriptRoot\ps_modules\TelemetryHelper

#### MAIN EXECUTION OF AZURE FILE COPY TASK BEGINS HERE ####
try {
    try
    {
        # Importing required version of azure cmdlets according to azureps installed on machine
        $azureUtility = Get-AzureUtility $connectedServiceName

        Write-Verbose -Verbose "Loading $azureUtility"
        . "$PSScriptRoot/$azureUtility"

        # Telemetry for endpoint id
        $telemetryJsonContent = "{`"endpointId`":`"$connectedServiceName`"}"
        Write-Host "##vso[telemetry.publish area=TaskEndpointId;feature=AzureFileCopy]$telemetryJsonContent"

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

        # creating temporary container for uploading files if no input is provided for container name
        if([string]::IsNullOrEmpty($containerName) -or ($destination -ne "AzureBlob"))
        {
            $containerName = [guid]::NewGuid().ToString()
            Create-AzureContainer -containerName $containerName -storageContext $storageContext -isPremiumStorage $isPremiumStorage
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
    if ($useDefaultArgumentsForBlobCopy)
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
    }

    Check-ContainerNameAndArgs -containerName $containerName -additionalArguments $additionalArgumentsForBlobCopy

    # Uploading files to container
    Upload-FilesToAzureContainer -sourcePath $sourcePath `
                                -storageAccountName $storageAccount `
                                -containerName $containerName `
                                -blobPrefix $blobPrefix `
                                -blobStorageEndpoint $blobStorageEndpoint `
                                -storageKey $storageKey `
                                -azCopyLocation $azCopyLocation `
                                -additionalArguments $additionalArgumentsForBlobCopy `
                                -destinationType $destination `
                                -useDefaultArguments $useDefaultArgumentsForBlobCopy `
                                -azCopyLogFilePath $logFilePath

    # Complete the task if destination is azure blob
    if ($destination -eq "AzureBlob")
    {
        # Get URI and SaSToken for output if needed
        if(-not [string]::IsNullOrEmpty($outputStorageURI))
        {
            $storageAccountContainerURI = $storageContext.BlobEndPoint + $containerName + "/"
            Write-Host "##vso[task.setvariable variable=$outputStorageURI;]$storageAccountContainerURI"
        }
        if(-not [string]::IsNullOrEmpty($outputStorageContainerSASToken))
        {
            $storageContainerSaSToken = New-AzureStorageContainerSASToken -Container $containerName -Context $storageContext -Permission rl -ExpiryTime (Get-Date).AddHours($defaultSasTokenTimeOutInHours)
            Write-Host "##vso[task.setvariable variable=$outputStorageContainerSASToken;]$storageContainerSasToken"
        }

        Remove-EndpointSecrets
        Write-Verbose "Completed Azure File Copy Task for Azure Blob Destination"
        
        return
    }

    # Copying files to Azure VMs
    try
    {
        # Normalize admin username
        if($vmsAdminUserName -and (-not $vmsAdminUserName.StartsWith(".\")) -and ($vmsAdminUserName.IndexOf("\") -eq -1) -and ($vmsAdminUserName.IndexOf("@") -eq -1))
        {
            $vmsAdminUserName = ".\" + $vmsAdminUserName 
        }
        # getting azure vms properties(name, fqdn, winrmhttps port)
        $azureVMResourcesProperties = Get-AzureVMResourcesProperties -resourceGroupName $environmentName -connectionType $connectionType `
        -resourceFilteringMethod $resourceFilteringMethod -machineNames $machineNames -enableCopyPrerequisites $enableCopyPrerequisites -connectedServiceName $connectedServiceName

        $azureVMsCredentials = Get-AzureVMsCredentials -vmsAdminUserName $vmsAdminUserName -vmsAdminPassword $vmsAdminPassword

        # Get Invoke-RemoteScript parameters
        $invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMResourcesProperties `
                                                                    -networkCredentials $azureVMsCredentials `
                                                                    -skipCACheck $skipCACheck

        # generate container sas token with full permissions
        $containerSasToken = Generate-AzureStorageContainerSASToken -containerName $containerName -storageContext $storageContext -tokenTimeOutInHours $defaultSasTokenTimeOutInHours

        # Copies files on azureVMs 
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
        Remove-EndpointSecrets
        Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
finally {
    Disconnect-AzureAndClearContext -authScheme $connectionType -ErrorAction SilentlyContinue
}