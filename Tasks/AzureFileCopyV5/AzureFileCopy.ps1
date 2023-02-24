[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

# Get inputs for the task
$sourcePath = Get-VstsInput -Name SourcePath -Require
$destination = Get-VstsInput -Name Destination -Require
$connectedServiceName = Get-VstsInput -Name ConnectedServiceNameARM -Require
$storageAccount = Get-VstsInput -Name StorageAccountRM
$containerName = Get-VstsInput -Name ContainerName
$blobPrefix = Get-VstsInput -Name BlobPrefix
$environmentName = Get-VstsInput -Name EnvironmentNameRM
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

 $sasTokenTimeOutInMinutes = 240

if ($destination -eq "AzureBlob"){
    $userGivenTimeOutInMinutes = Get-VstsInput -Name SasTokenTimeOutInMinutes
    if($userGivenTimeOutInMinutes -ne ""){
        $sasTokenTimeOutInMinutes = $userGivenTimeOutInMinutes
    }
}

if ($destination -ne "AzureBlob")
{
    $blobPrefix = ""
}

# Constants
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

$endpoint = Get-VstsEndpoint -Name $connectedServiceName -Require

# Update PSModulePath for hosted agent
. "$PSScriptRoot\Utility.ps1"
CleanUp-PSModulePathForHostedAgent

$vstsEndpoint = Get-VstsEndpoint -Name SystemVssConnection -Require
$vstsAccessToken = $vstsEndpoint.auth.parameters.AccessToken

if (Get-Module Az.Accounts -ListAvailable) {
    Initialize-AzModule -Endpoint $endpoint -connectedServiceNameARM $connectedServiceName -vstsAccessToken $vstsAccessToken
}
else {
    Write-Verbose "No module found with name: Az.Accounts"
    throw ("Could not find the module Az.Accounts with given version. If the module was recently installed, retry after restarting the Azure Pipelines task agent.")
}

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
        $azureUtility = Get-AzureUtility

        Write-Verbose -Verbose "Loading $azureUtility"
        . "$PSScriptRoot/$azureUtility"

        # Telemetry for endpoint id
        $telemetryJsonContent = "{`"endpointId`":`"$connectedServiceName`"}"
        Write-Host "##vso[telemetry.publish area=TaskEndpointId;feature=AzureFileCopy]$telemetryJsonContent"

        # Getting storage key for the storage account
        $storageKey = Get-StorageKey -storageAccountName $storageAccount -endpoint $endpoint

        # creating storage context to be used while creating container, sas token, deleting container
        $storageContext = Create-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey
        
        # Geting Azure Storage Account type
        $storageAccountType = Get-StorageAccountType -storageAccountName $storageAccount -endpoint $endpoint
        Write-Verbose "Obtained Storage Account type: $storageAccountType"
        if(-not [string]::IsNullOrEmpty($storageAccountType) -and $storageAccountType.Contains('Premium'))
        {
            $isPremiumStorage = $true
        }

        # creating temporary container for uploading files if no input is provided for container name
        if([string]::IsNullOrEmpty($containerName) -or ($destination -ne "AzureBlob"))
        {
            $containerName = [guid]::NewGuid().ToString()
            Write-Verbose "Container Name input not found. Creating Temporary container for uploading files."
            Create-AzureContainer -containerName $containerName -storageContext $storageContext
        }
        else
        {
            #checking if the containerName provided exist or not
            $containerPresent = Get-AzureContainer -containerName $containerName -storageContext $storageContext

            #creating container if the containerName provided does not exist
            if($containerPresent -eq $null)
            {
                Write-Verbose "Creating container if the containerName provided does not exist"
                Create-AzureContainer -containerName $containerName -storageContext $storageContext
            }
        }

        
        # Getting Azure Blob Storage Endpoint
        $blobStorageEndpoint = Get-blobStorageEndpoint -storageAccountName $storageAccount -endpoint $endpoint

        # Setting environment variable for tracking Azure Pipelines usage in AzCopy telemetry
        $env:AZCOPY_USER_AGENT_PREFIX = "TFS_useragent"
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
        # log-level: Defines the log verbosity for the log file. Default is INFO(all requests/responses)

        Write-Verbose "Using default AzCopy arguments for uploading to blob storage"

        $additionalArgumentsForBlobCopy = "--log-level=INFO"

        # Add more arguments if required

        # Premium storage accounts only support page blobs
        if($isPremiumStorage)
        {
            Write-Verbose "Setting BlobType to page for Premium Storage account."
            $additionalArgumentsForBlobCopy += " --blob-type=PageBlob"
        }

        # $root container does not support sub folders. So excluding recursive copy option for $root container.
        if($containerName -ne '$root')
        {
            Write-Verbose "Adding argument for recursive copy"
            $additionalArgumentsForBlobCopy += " --recursive"
        }
    }

    Check-ContainerNameAndArgs -containerName $containerName -additionalArguments $additionalArgumentsForBlobCopy

    # Uploading files to container
    Upload-FilesToAzureContainer -sourcePath $sourcePath `
                                -endPoint $endpoint `
                                -storageAccountName $storageAccount `
                                -containerName $containerName `
                                -blobPrefix $blobPrefix `
                                -blobStorageEndpoint $blobStorageEndpoint `
                                -azCopyLocation $azCopyLocation `
                                -additionalArguments $additionalArgumentsForBlobCopy `
                                -destinationType $destination `
                                -useDefaultArguments $useDefaultArgumentsForBlobCopy `
                                -cleanTargetBeforeCopy $cleanTargetBeforeCopy `
    
    # Complete the task if destination is azure blob
    if ($destination -eq "AzureBlob")
    {
        # Get URI and SaSToken for output variable
        $storageAccountContainerURI = $storageContext.BlobEndPoint + $containerName + "/"
        Write-Host "##vso[task.setvariable variable=StorageContainerUri]$storageAccountContainerURI"
        
        
        $storageContainerSaSToken = Generate-AzureStorageContainerSASToken -containerName $containerName -storageContext $storageContext -tokenTimeOutInMinutes $sasTokenTimeOutInMinutes
        Write-Host "##vso[task.setvariable variable=StorageContainerSasToken]$storageContainerSasToken"

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
        $azureVMResourcesProperties = Get-AzureVMResourcesProperties -resourceGroupName $environmentName `
        -resourceFilteringMethod $resourceFilteringMethod -machineNames $machineNames -enableCopyPrerequisites $enableCopyPrerequisites -connectedServiceName $connectedServiceName

        $azureVMsCredentials = Get-AzureVMsCredentials -vmsAdminUserName $vmsAdminUserName -vmsAdminPassword $vmsAdminPassword

        # Get Invoke-RemoteScript parameters
        $invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMResourcesProperties `
                                                                    -networkCredentials $azureVMsCredentials `
                                                                    -skipCACheck $skipCACheck

        # generate container sas token with full permissions
        $containerSasToken = Generate-AzureStorageContainerSASToken -containerName $containerName -storageContext $storageContext -tokenTimeOutInMinutes $sasTokenTimeOutInMinutes

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
    Disconnect-AzureAndClearContext -authScheme $endpoint.Auth.Scheme -ErrorAction SilentlyContinue
}