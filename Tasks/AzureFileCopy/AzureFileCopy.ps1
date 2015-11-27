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
$azureFileCopyOperation = 'AzureFileCopy'
$ErrorActionPreference = 'Stop'
$telemetrySet = $false

try
{ 
    # Load all dependent files for execution
    Import-Module ./AzureFileCopyJob.ps1 -Force
    Import-Module ./AzureUtility.ps1 -Force
    Import-Module ./Utility.ps1 -Force

    # Import all the dlls and modules which have cmdlets we need
    Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
    Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"
    Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

    # enabling detailed logging only when system.debug is true
    $enableDetailedLoggingString = $env:system_debug
    if ($enableDetailedLoggingString -ne "true")
    {
        $enableDetailedLoggingString = "false"
    }

    # azcopy location on automation agent
    $agentHomeDir = $env:AGENT_HOMEDIRECTORY
    $azCopyLocation = Join-Path $agentHomeDir -ChildPath "Agent\Worker\Tools\AzCopy"

    $isSwitchAzureModeRequired = Does-RequireSwitchAzureMode

    if($isSwitchAzureModeRequired)
    {
        Write-Verbose "Azure Powershell commandlet version is less than 0.9.9" -Verbose
        Import-Module ./AzureResourceManagerLegacyProvider.ps1 -Force
    }

    # try to get storage key from RDFE, if not exists will try from ARM endpoint
    $storageAccount = $storageAccount.Trim()
    try
    {
        if($isSwitchAzureModeRequired)
        {
            Write-Verbose "Switching Azure mode to AzureServiceManagement." -Verbose
            Switch-AzureMode AzureServiceManagement
        }

        # getting storage key from RDFE    
        $storageKey = Get-AzureStorageKeyFromRDFE -storageAccountName $storageAccount

        Write-Verbose "RDFE call succeeded. Loading ARM Wrapper." -Verbose
    }
    catch [Hyak.Common.CloudException], [System.ApplicationException], [System.Management.Automation.CommandNotFoundException]
    {
        $errorMsg = $_.Exception.Message.ToString()
        Write-Verbose "[Azure Call](RDFE) $errorMsg" -Verbose

        # checking azure powershell version to make calls to ARM endpoint
        Validate-AzurePowershellVersion

        if($isSwitchAzureModeRequired)
        {
            Write-Verbose "Switching Azure mode to AzureResourceManager." -Verbose
            Switch-AzureMode AzureResourceManager
        }

        # getting storage account key from ARM endpoint
        $storageKey = Get-AzureStorageKeyFromARM -storageAccountName $storageAccount
    }

    # creating storage context to be used while creating container, sas token, deleting container
    $storageContext = New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey

    # creating temporary container for uploading files
    if ([string]::IsNullOrEmpty($containerName))
    {
        $containerName = [guid]::NewGuid().ToString();
        Write-Verbose "[Azure Call]Creating container: $containerName in storage account: $storageAccount" -Verbose
        $container = New-AzureStorageContainer -Name $containerName -Context $storageContext -Permission Container
        Write-Verbose "[Azure Call]Created container: $containerName successfully in storage account: $storageAccount" -Verbose
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

# uploading files to container
$sourcePath = $sourcePath.Trim('"')
try
{
    Write-Output (Get-LocalizedString -Key "Uploading files from source path: '{0}' to storage account: '{1}' in container: '{2}' with blobprefix: '{3}'" -ArgumentList $sourcePath, $storageAccount, $containerName, $blobPrefix)
    $uploadResponse = Copy-FilesToAzureBlob -SourcePathLocation $sourcePath -StorageAccountName $storageAccount -ContainerName $containerName -BlobPrefix $blobPrefix -StorageAccountKey $storageKey -AzCopyLocation $azCopyLocation -AdditionalArguments $additionalArguments
}
catch
{
    # deletes container only if we have created temporary container
    if ($destination -ne "AzureBlob")
    {
        Remove-AzureContainer -containerName $containerName -storageContext $storageContext -storageAccount $storageAccount
    }

    Write-Verbose $_.Exception.ToString() -Verbose
    $error = $_.Exception.Message
    $errorMessage = (Get-LocalizedString -Key "Upload to container: '{0}' in storage account: '{1}' with blobprefix: '{2}' failed with error: '{3}'" -ArgumentList $containerName, $storageAccount, $blobPrefix, $error)
    Write-TaskSpecificTelemetry "AZUREPLATFORM_BlobUploadFailed"
    ThrowError -errorMessage $errorMessage
}
finally
{
    if ($uploadResponse.Status -eq "Failed")
    {
        # deletes container only if we have created temporary container
        if ($destination -ne "AzureBlob")
        {
            Remove-AzureContainer -containerName $containerName -storageContext $storageContext -storageAccount $storageAccount
        }

        $error = $uploadResponse.Error
        $errorMessage = (Get-LocalizedString -Key "Upload to container: '{0}' in storage account: '{1}' with blobprefix: '{2}' failed with error: '{3}'" -ArgumentList $containerName, $storageAccount, $blobPrefix, $error)
        Write-TaskSpecificTelemetry "AZUREPLATFORM_BlobUploadFailed"
        ThrowError -errorMessage $errorMessage
    }
    elseif ($uploadResponse.Status -eq "Succeeded")
    {
        Write-Output (Get-LocalizedString -Key "Uploaded files successfully from source path: '{0}' to storage account: '{1}' in container: '{2}' with blobprefix: '{3}'" -ArgumentList $sourcePath, $storageAccount, $containerName, $blobPrefix)
    }
}

# do not proceed further if destination is azure blob
if ($destination -eq "AzureBlob")
{
    Write-Verbose "Completed Azure File Copy Task for Azure Blob Destination" -Verbose
    return
}

$envOperationStatus = 'Passed'
# copying files to azure vms
try
{
    Initialize-GlobalMaps
    
    if($isSwitchAzureModeRequired)
    {
        Write-Verbose "Switching Azure mode to AzureServiceManagement" -Verbose
        Switch-AzureMode AzureServiceManagement
    }

    $azureVMResources = Get-AzureClassicVMsInResourceGroup -resourceGroupName $environmentName
    Get-MachineConnectionInformationForClassicVms -resourceGroupName $environmentName
    
    if($azureVMResources.Count -eq 0)
    {
        if($isSwitchAzureModeRequired)
        {
            Write-Verbose "Switching Azure mode to AzureResourceManager." -Verbose
            Switch-AzureMode AzureResourceManager
        }

        $azureVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $environmentName
        if ($azureVMResources.Count -eq 0)
        {
            Write-TaskSpecificTelemetry "PREREQ_NoVMResources"
            throw (Get-LocalizedString -Key "No machine exists under resource group: '{0}' for copy" -ArgumentList $environmentName)
        }

        Get-MachineConnectionInformationForRMVms -resourceGroupName $environmentName
    }

    $azureVMResourcesPropertiesBag = Get-AzureVMResourcesProperties -resources $azureVMResources

    $skipCACheckOption = Get-SkipCACheckOption -skipCACheck $skipCACheck
    $azureVmsCredentials = Get-AzureVMsCredentials -vmsAdminUserName $vmsAdminUserName -vmsAdminPassword $vmsAdminPassword

    # create container sas token with full permissions
    Write-Verbose "[Azure Call]Generating SasToken for container: $containerName in storage: $storageAccount with expiry time: $defaultSasTokenTimeOutInHours hours" -Verbose
    $containerSasToken = New-AzureStorageContainerSASToken -Name $containerName -ExpiryTime (Get-Date).AddHours($defaultSasTokenTimeOutInHours) -Context $storageContext -Permission rwdl
    Write-Verbose "[Azure Call]Generated SasToken: $containerSasToken successfully for container: $containerName in storage: $storageAccount" -Verbose

    # copies files sequentially
    if ($copyFilesInParallel -eq "false" -or ( $resources.Count -eq 1 ))
    {
        foreach ($resource in $azureVMResources)
        {
            $resourceProperties = $azureVMResourcesPropertiesBag.Item($resource.Name)
            $resourceFQDN = $resourceProperties.fqdn
            $resourceName = $resourceProperties.Name
            $resourceWinRMHttpsPort = $resourceProperties.winRMHttpsPort

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $resourceName)

            $copyResponse = Invoke-Command -ScriptBlock $AzureFileCopyJob -ArgumentList $resourceFQDN, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $azureVmsCredentials, $cleanTargetBeforeCopy, $resourceWinRMHttpsPort, $useHttpsProtocolOption, $skipCACheckOption, $enableDetailedLoggingString, $additionalArguments
            $status = $copyResponse.Status

            Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $resourceName -deploymentResponse $copyResponse
            Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $resourceName, $status)

            if ($status -ne "Passed")
            {
                Write-Verbose $copyResponse.Error.ToString() -Verbose
                $errorMessage =  $copyResponse.Error.Message
                Write-TaskSpecificTelemetry "UNKNOWNDEP_Error"
                ThrowError -errorMessage $errorMessage
            }
        }
    }
    # copies files parallely
    else
    {
        [hashtable]$Jobs = @{}
        foreach ($resource in $azureVMResources)
        {
            $resourceProperties = $azureVMResourcesPropertiesBag.Item($resource.Name)
            $resourceFQDN = $resourceProperties.fqdn
            $resourceName = $resourceProperties.Name
            $resourceWinRMHttpsPort = $resourceProperties.winRMHttpsPort

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $resourceName)

            $job = Start-Job -ScriptBlock $AzureFileCopyJob -ArgumentList $resourceFQDN, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $azureVmsCredentials, $cleanTargetBeforeCopy, $resourceWinRMHttpsPort, $useHttpsProtocolOption, $skipCACheckOption, $enableDetailedLoggingString, $additionalArguments
            $Jobs.Add($job.Id, $resourceProperties)
        }

        While (Get-Job)
        {
            Start-Sleep 10
            foreach ($job in Get-Job)
            {
                if ($job.State -ne "Running")
                {
                    $output = Receive-Job -Id $job.Id
                    Remove-Job $Job

                    $status = $output.Status
                    $resourceName = $Jobs.Item($job.Id).Name

                    Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $resourceName -deploymentResponse $output
                    Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $resourceName, $status)

                    if ($status -ne "Passed")
                    {
                        $envOperationStatus = "Failed"
                        $errorMessage = ""
                        if($output.Error -ne $null)
                        {
                            $errorMessage = $output.Error.Message
                        }
                        Write-Output (Get-LocalizedString -Key "Copy failed on machine '{0}' with following message : '{1}'" -ArgumentList $resourceName, $errorMessage)
                    }
                }
            }
        }
    }

    if ($envOperationStatus -ne "Passed")
    {
        $errorMessage = (Get-LocalizedString -Key 'Copy to one or more machines failed.')
        Write-TaskSpecificTelemetry "UNKNOWNDEP_Error"
        ThrowError -errorMessage $errorMessage
    }
    else
    {
        Write-Output (Get-LocalizedString -Key "Copied files from source path: '{0}' to target azure vms in resource group: '{1}' successfully" -ArgumentList $sourcePath, $environmentName)
    }
}
catch
{
    Write-Verbose $_.Exception.ToString() -Verbose
    Write-TaskSpecificTelemetry "UNKNOWNDEP_Error"
    throw
}
finally
{
    Remove-AzureContainer -containerName $containerName -storageContext $storageContext -storageAccount $storageAccount
    Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
}