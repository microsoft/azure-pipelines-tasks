param (
    [string][Parameter(Mandatory=$true)]$connectedServiceName,
    [string][Parameter(Mandatory=$true)]$sourcePath,
    [string][Parameter(Mandatory=$true)]$storageAccount,
    [string][Parameter(Mandatory=$true)]$destination,
    [string]$containerName,
    [string]$blobPrefix,
    [string]$environmentName,
    [string]$machineNames,
    [string]$targetPath,
    [string]$cleanTargetBeforeCopy,
    [string]$copyFilesInParallel
)

Write-Verbose "Starting Azure File Copy Task" -Verbose

Write-Verbose "connectedServiceName = $connectedServiceName" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "storageAccount = $storageAccount" -Verbose
Write-Verbose "destination = $destination" -Verbose
Write-Verbose "containerName = $containerName" -Verbose
Write-Verbose "blobPrefix = $blobPrefix" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose

# Constants #
$defaultWinRMPort = '5986'
$defaultConnectionProtocolOption = ''
$defaultSasTokenTimeOutInHours = 2

$useHttpProtocolOption = '-UseHttp'
$useHttpsProtocolOption = ''

$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''

$azureFileCopyOperation = 'AzureFileCopy'
$ErrorActionPreference = 'Stop'

$ARMStorageAccountResourceType =  "Microsoft.Storage/storageAccounts"

. ./AzureFileCopyJob.ps1

# Import all the dlls and modules which have cmdlets we need
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

# Getting resource tag key name for corresponding tag
$resourceFQDNKeyName = Get-ResourceFQDNTagKey
$resourceWinRMHttpPortKeyName = Get-ResourceHttpTagKey
$resourceWinRMHttpsPortKeyName = Get-ResourceHttpsTagKey
$skipCACheckKeyName = Get-SkipCACheckTagKey

function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    Write-Verbose "(ARM)Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose
    $azureStorageAccountResourceDetails = Get-AzureResource -ResourceName $storageAccountName | Where-Object { $_.ResourceType -eq $ARMStorageAccountResourceType }
    Write-Verbose "(ARM)Retrieved resource details successfully for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose

    $azureResourceGroupName = $azureStorageAccountResourceDetails.ResourceGroupName
    if ([string]::IsNullOrEmpty($azureResourceGroupName) -eq $true)
    {
        Write-Verbose "(ARM)Storage sccount: $storageAccountName not found" -Verbose
        Throw (Get-LocalizedString -Key "Storage acccout: {0} not found. Please specify existing storage account" -ArgumentList $storageAccountName)
    }

    return $azureStorageAccountResourceDetails.ResourceGroupName
}

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName)

    # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

    Write-Verbose "(ARM)Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose
    $storageKeyDetails = Get-AzureStorageAccountKey -ResourceGroupName $azureResourceGroupName -Name $storageAccount 
    $storageKey = $storageKeyDetails.Key1
    Write-Verbose "(ARM)Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose

    return $storageKey
}

function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName)

    Write-Verbose "(RDFE)Retrieving storage key for the storage account: $storageAccount" -Verbose
    $storageKeyDetails = Get-AzureStorageKey -StorageAccountName $storageAccountName
    $storageKey = $storageKeyDetails.Primary
    Write-Verbose "(RDFE)Retrieved storage key successfully for the storage account: $storageAccount" -Verbose

    return $storageKey
}

function Validate-AzurePowershellVersion
{
    Write-Verbose "Validating minimum required azure powershell version" -Verbose

    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion
    
    if(!$versionCompatible)
    {
        Throw (Get-LocalizedString -Key "The required minimum version {0} of the Azure Powershell Cmdlets are not installed. You can follow the instructions at http://azure.microsoft.com/en-in/documentation/articles/powershell-install-configure/ to get the latest Azure powershell" -ArgumentList $minimumAzureVersion)
    }

    Write-Verbose -Verbose "Validated the required azure powershell version"
}

function Remove-AzureContainer
{
    param([string]$containerName,
          [Microsoft.WindowsAzure.Commands.Common.Storage.AzureStorageContext]$storageContext,
          [string]$storageAccount)

    Write-Verbose "Deleting container: $containerName in storage account: $storageAccount" -Verbose
    Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
}

function Get-ResourceCredentials
{
    param([object]$resource)

    $machineUserName = $resource.Username
    Write-Verbose "`t Resource Username - $machineUserName" -Verbose

    $machinePassword = $resource.Password
    $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

    return $credential
}

function Get-ResourceConnectionDetails
{
    param([object]$resource,
          [Microsoft.VisualStudio.Services.Client.VssConnection]$connection)

    $resourceProperties = @{}
    $resourceName = $resource.Name

    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName
    Write-Verbose "`t Resource fqdn - $fqdn" -Verbose

    $winrmPortToUse = ''
    $protocolToUse = ''
    # check whether https port is defined for resource
    $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceName $resourceName
    if ([string]::IsNullOrEmpty($winrmHttpsPort))
    {
        Write-Verbose "`t Resource: $resourceName does not have any winrm https port defined, checking for winrm http port" -Verbose

        $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName
        # if resource does not have any port defined then, use https port by default
        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
            Write-Verbose "`t Resource: $resourceName does not have any winrm http port or https port defined, using https port by default" -Verbose
            $winrmPortToUse = $defaultWinRMPort
            $protocolToUse = $defaultConnectionProtocolOption
        }
        else
        {
            # if resource has winrm http port defined
            $winrmPortToUse = $winrmHttpPort
            $protocolToUse = $useHttpProtocolOption
        }
    }
    else
    {
        # if resource has winrm https port opened
        $winrmPortToUse = $winrmHttpsPort
        $protocolToUse = $useHttpsProtocolOption
    }

    Write-Verbose "`t Using port: $winrmPortToUse" -Verbose

    $resourceProperties.fqdn = $fqdn
    $resourceProperties.winrmPort = $winrmPortToUse
    $resourceProperties.httpProtocolOption = $protocolToUse
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource

    return $resourceProperties
}

function Get-SkipCACheckOption
{
    param([string]$environmentName,
          [Microsoft.VisualStudio.Services.Client.VssConnection]$connection)

    $skipCACheckOption = $doSkipCACheckOption

    # get skipCACheck option from environment
    $skipCACheckBool = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $skipCACheckKeyName -Connection $connection
    if ($skipCACheckBool -eq "false")
    {
        $skipCACheckOption = $doNotSkipCACheckOption
    }

    return $skipCACheckOption
}

function Get-ResourcesProperties
{
    param([object]$resources,
          [Microsoft.VisualStudio.Services.Client.VssConnection]$connection)

    $skipCACheckOption = Get-SkipCACheckOption -environmentName $environmentName -connection $connection

    [hashtable]$resourcesPropertyBag = @{}
    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        Write-Verbose "Get Resource properties for $resourceName" -Verbose

        # Get other connection details for resource like - Fqdn WinRM Port, Http Protocol, SkipCACheck Option, Resource Credentials
        $resourceProperties = Get-ResourceConnectionDetails -resource $resource -connection $connection
        $resourceProperties.skipCACheckOption = $skipCACheckOption

        $resourcesPropertyBag.Add($resourceName, $resourceProperties)
    }

    return $resourcesPropertyBag
}

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingString = $env:system_debug
if ($enableDetailedLoggingString -ne "true")
{
    $enableDetailedLoggingString = "false"
}

# azcopy location on automation agent
$agentHomeDir = $env:AGENT_HOMEDIRECTORY
$azCopyLocation = Join-Path $agentHomeDir -ChildPath "Agent\Worker\Tools\AzCopy"

# try to get storage key from RDFE, if not exists will try from ARM endpoint
try
{
    Switch-AzureMode AzureServiceManagement

    # getting storage key from RDFE
    $storageKey = Get-AzureStorageKeyFromRDFE -storageAccountName $storageAccount
}
catch [Hyak.Common.CloudException]
{
    Write-Verbose "(RDFE)$_.Exception.Message.ToString()" -Verbose

    # checking azure powershell version to make calls to ARM endpoint
    Validate-AzurePowershellVersion

    Switch-AzureMode AzureResourceManager

    # getting storage account key from ARM endpoint
    $storageKey = Get-AzureStorageKeyFromARM -storageAccountName $storageAccount
}

# creating storage context to be used while creating container, sas token, deleting container
$storageContext = New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey

# creating temporary container for uploading files
if ([string]::IsNullOrEmpty($containerName))
{
    $containerName = [guid]::NewGuid().ToString();
    Write-Verbose "Creating container: $containerName in storage account: $storageAccount" -Verbose
    $container = New-AzureStorageContainer -Name $containerName -Context $storageContext -Permission Container
    Write-Verbose "Created container: $containerName successfully in storage account: $storageAccount" -Verbose
}

# uploading files to container
try
{
    Write-Output (Get-LocalizedString -Key "Uploading files from source path: '{0}' to storage account: '{1}' in container: '{2}' with blobprefix: '{3}'" -ArgumentList $sourcePath, $storageAccount, $containerName, $blobPrefix)
    $uploadResponse = Copy-FilesToAzureBlob -SourcePathLocation $sourcePath -StorageAccountName $storageAccount -ContainerName $containerName -BlobPrefix $blobPrefix -StorageAccountKey $storageKey -AzCopyLocation $azCopyLocation
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
    throw (Get-LocalizedString -Key "Upload to container: '{0}' in storage account: '{1}' with blobprefix: '{2}' failed with error: '{3}'" -ArgumentList $containerName, $storageAccount, $blobPrefix, $error)
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
        throw (Get-LocalizedString -Key "Upload to container: '{0}' in storage account: '{1}' with blobprefix: '{2}' failed with error: '{3}'" -ArgumentList $containerName, $storageAccount, $blobPrefix, $error)
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
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection

    $envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName $azureFileCopyOperation -Connection $connection
    Write-Verbose "Invoking Azure File Copy Operation on environment: $environmentName with operationId: $envOperationId" -Verbose

    $resourcesPropertyBag = Get-ResourcesProperties -resources $resources -connection $connection

    # create container sas token with full permissions
    Write-Verbose "Generating SasToken for container: $containerName in storage: $storageAccount with expiry time: $defaultSasTokenTimeOutInHours hours" -Verbose
    $containerSasToken = New-AzureStorageContainerSASToken -Name $containerName -ExpiryTime (Get-Date).AddHours($defaultSasTokenTimeOutInHours) -Context $storageContext -Permission rwdl
    Write-Verbose "Generated SasToken: $containerSasToken successfully for container: $containerName in storage: $storageAccount" -Verbose

    # copies files sequentially
    if ($copyFilesInParallel -eq "false" -or ( $resources.Count -eq 1 ))
    {
        foreach ($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Name)
            $machine = $resourceProperties.fqdn

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $machine)

            $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection
            Write-Verbose "ResourceOperationId = $resOperationId" -Verbose

            $copyResponse = Invoke-Command -ScriptBlock $AzureFileCopyJob -ArgumentList $machine, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString
            $status = $copyResponse.Status

            Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $machine -deploymentResponse $copyResponse
            Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)

            Write-Verbose "Complete ResourceOperation for resource: $($resource.Name)" -Verbose

            # getting operation logs
            $logs = Get-OperationLogs
            Write-Verbose "Upload BuildUri $logs as operation logs." -Verbose

            Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $copyResponse.Status -ErrorMessage $copyResponse.Error -Logs $logs -Connection $connection

            if ($status -ne "Passed")
            {
                Write-Verbose "Completed operation: $azureFileCopyOperation with operationId: $envOperationId on environment: $environmentName with status: Failed" -Verbose
                Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection
                
                Write-Verbose $copyResponse.Error.ToString() -Verbose
                throw $copyResponse.Error
            }
        }
    }
    # copies files parallely
    else
    {
        [hashtable]$Jobs = @{}
        foreach ($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Name)
            $machine = $resourceProperties.fqdn

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $machine)

            $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection
            Write-Verbose "ResourceOperationId = $resOperationId" -Verbose

            $resourceProperties.resOperationId = $resOperationId
            $job = Start-Job -ScriptBlock $AzureFileCopyJob -ArgumentList $machine, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString
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
                    if ($status -ne "Passed")
                    {
                        $envOperationStatus = "Failed"
                    }

                    $machineName = $Jobs.Item($job.Id).fqdn
                    $resOperationId = $Jobs.Item($job.Id).resOperationId

                    Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $machineName -deploymentResponse $output
                    Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)

                    Write-Verbose "Complete ResourceOperation for resource operation id: $resOperationId" -Verbose
                    # getting operation logs
                    $logs = Get-OperationLogs
                    Write-Verbose "Upload BuildUri $logs as operation logs." -Verbose

                    Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $output.Status -ErrorMessage $output.Error -Logs $logs -Connection $connection
                }
            }
        }
    }

    Write-Verbose "Completed operation: $azureFileCopyOperation with operationId: $envOperationId on environment: $environmentName with status: $envOperationStatus" -Verbose
    Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection

    if ($envOperationStatus -ne "Passed")
    {
        throw (Get-LocalizedString -Key 'Copy to one or more machines failed')
    }
    else
    {
        Write-Output (Get-LocalizedString -Key "Copied files from source path: '{0}' to target azure vms in environment: '{1}' successfully" -ArgumentList $sourcePath, $environmentName)
    }
}
catch
{
    Write-Verbose $_.Exception.ToString() -Verbose
    throw
}
finally
{
    Remove-AzureContainer -containerName $containerName -storageContext $storageContext -storageAccount $storageAccount
    Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
}