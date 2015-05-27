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
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose

# Constants #
$defaultWinRMPort = '5986'

$defaultHttpProtocolOption = ''
$useHttpProtocolOption = '-UseHttp'
$useHttpsProtocolOption = ''

$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''

$envOperationStatus = 'Passed'
$defaultSasTokenTimeOutInHours = 2

. ./AzureFileCopyJob.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

$resourceFQDNKeyName = Get-ResourceFQDNTagKey
$resourceWinRMHttpPortKeyName = Get-ResourceHttpTagKey
$resourceWinRMHttpsPortKeyName = Get-ResourceHttpsTagKey
$skipCACheckKeyName = Get-SkipCACheckTagKey

function Remove-AzureContainer
{
    param([string]$containerName,
          [object]$storageContext,
          [string]$storageAccount)

    Write-Verbose "Deleting container: $containerName in storage account: $storageAccount" -Verbose
    Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
}

function Get-ResourceCredentials
{
    param([object]$resource)

    $machineUserName = $resource.Username
    Write-Verbose "`t`t Resource Username - $machineUserName" -Verbose

    $machinePassword = $resource.Password
    $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

    return $credential
}

function Get-ResourceConnectionDetails
{
    param([object]$resource)

    $resourceProperties = @{}
    $resourceName = $resource.Name

    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
    Write-Verbose "`t`t Resource fqdn - $fqdn" -Verbose

    $resourceProperties.fqdn = $fqdn

    $winrmPortToUse = ''
    $protocolToUse = ''
    # check whether https port is defined for resource
    $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
    if ([string]::IsNullOrEmpty($winrmHttpsPort))
    {
        Write-Verbose "`t`t Resource: $resourceName does not have any winrm https port defined, checking for winrm http port" -Verbose

        $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
        # if resource does not have any port defined then, use https port by default
        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
            Write-Verbose "`t`t Resource: $resourceName does not have any winrm http port or https port defined, using https port by default" -Verbose
            $winrmPortToUse = $defaultWinRMPort
            $protocolToUse = $useHttpsProtocolOption
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

    Write-Verbose "`t`t Trying to use port: $winrmPortToUse" -Verbose

    $resourceProperties.winrmPort = $winrmPortToUse
    $resourceProperties.httpProtocolOption = $protocolToUse
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource

    return $resourceProperties
}

function Get-SkipCACheckOption
{
    param([string]$environmentName,
          [object]$connection)

    $skipCACheckOption = $doSkipCACheckOption

    # get skipCACheck option from environment
    $skipCACheckBool = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $skipCACheckKeyName -Connection $connection -ErrorAction Stop

    if ($skipCACheckBool -eq "false")
    {
        $skipCACheckOption = $doNotSkipCACheckOption
    }

    return $skipCACheckOption
}

function Get-ResourcesProperties
{
    param([object]$resources)

    $skipCACheckOption = Get-SkipCACheckOption -environmentName $environmentName -connection $connection

    [hashtable]$resourcesPropertyBag = @{}
    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        Write-Verbose "Get Resource properties for $resourceName" -Verbose

        # Get other connection details for resource like - fqdn wirmport, http protocol, skipCACheckOption, resource credentials
        $resourceProperties = Get-ResourceConnectionDetails -resource $resource
        $resourceProperties.skipCACheckOption = $skipCACheckOption

        $resourcesPropertyBag.Add($resourceName, $resourceProperties)
    }

    return $resourcesPropertyBag
}

# azcopy location on automation agent
$agentHomeDir = $env:AGENT_HOMEDIRECTORY
$azCopyLocation = Join-Path $agentHomeDir -ChildPath "Agent\Worker\Tools\AzCopy"

# getting storage account key
$storageKeyDetails = Get-AzureStorageKey -StorageAccountName $storageAccount
$storageKey = $storageKeyDetails.Primary

# creating storage context to be used while creating container, sas token, deleting container
$storageContext = New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey

# creating temporary container for uploading files
if ([string]::IsNullOrEmpty($containerName))
{
    $containerName = [guid]::NewGuid().ToString();
    $container = New-AzureStorageContainer -Name $containerName -Context $storageContext -Permission Container
    Write-Verbose "Created container: $containerName in storage account: $storageAccount" -Verbose
}

# uploading files to container
try
{
    Write-Output "Uploading files from source path: $sourcePath to storage account: $storageAccount in container: $containerName with blobprefix: $blobPrefix" -Verbose
    $uploadResponse = Copy-FilesToAzureBlob -SourcePathLocation $sourcePath -StorageAccountName $storageAccount -ContainerName $containerName -BlobPrefix $blobPrefix -StorageAccountKey $storageKey -AzCopyLocation $azCopyLocation
}
catch
{
    # deletes container only if we have created temporary container
    if ($destination -ne "AzureBlob")
    {
        Remove-AzureContainer -containerName $containerName -storageContext $storageContext -storageAccount $storageAccount
    }

    throw "Upload to blob failed."
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
        throw "Upload to blob failed. $error"
    }
    elseif ($uploadResponse.Status -eq "Succeeded")
    {
        Write-Output "Uploaded files successfully from source path: $sourcePath to storage account: $storageAccount in container: $containerName with blobprefix: $blobPrefix" -Verbose
    }
}

# do not proceed further if destination is azure blob
if ($destination -eq "AzureBlob")
{
    Write-Verbose "Completed Azure File Copy Task for Azure Blob Destination" -Verbose
    return
}

# copying files to azure vms
try
{
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection -ErrorAction Stop

    $envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Azure File Copy" -Connection $connection -ErrorAction Stop
    Write-Verbose "envOperationId = $envOperationId" -Verbose

    $resourcesPropertyBag = Get-ResourcesProperties -resources $resources

    # create container sas token with full permissions
    $containerSasToken = New-AzureStorageContainerSASToken -Name $containerName -ExpiryTime (Get-Date).AddHours($defaultSasTokenTimeOutInHours) -Context $storageContext -Permission rwdl
    Write-Verbose "Created SasToken: $containerSasToken for container: $containerName in storage: $storageAccount" -Verbose

    # copies files sequentially
    if ($copyFilesInParallel -eq "false" -or ( $resources.Count -eq 1 ))
    {
        foreach ($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Name)
            $machine = $resourceProperties.fqdn

            Write-Output "Copy Started for - $machine"

            $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
            Write-Verbose "ResourceOperationId = $resOperationId" -Verbose

            $copyResponse = Invoke-Command -ScriptBlock $AzureFileCopyJob -ArgumentList $machine, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption
            $status = $copyResponse.Status

            Write-ResponseLogs -operationName "copy" -fqdn $machine -deploymentResponse $copyResponse
            Write-Output "Copy Status for machine $machine : $status"

            Write-Verbose "Complete ResourceOperation for  - $machine" -Verbose
            $logs = Get-ResourceOperationLogs -deploymentResponse $copyResponse
            Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $copyResponse.Status -ErrorMessage $copyResponse.Error -Logs $logs -Connection $connection -ErrorAction Stop

            if ($status -ne "Passed")
            {
                Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection -ErrorAction Stop
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

            Write-Output "Copy Started for - $machine"

            $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
            Write-Verbose "ResourceOperationId = $resOperationId" -Verbose

            $resourceProperties.resOperationId = $resOperationId
            $job = Start-Job -ScriptBlock $AzureFileCopyJob -ArgumentList $machine, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption
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

                    Write-ResponseLogs -operationName "copy" -fqdn $machineName -deploymentResponse $output
                    Write-Output "Copy Status for machine $machineName : $status"

                    Write-Verbose "Complete ResourceOperation for  - $machine" -Verbose
                    $logs = Get-ResourceOperationLogs -deploymentResponse $output
                    Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $output.Status -ErrorMessage $output.Error -Logs $logs -Connection $connection -ErrorAction Stop
                }
            }
        }
    }

    Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop

    if ($envOperationStatus -ne "Passed")
    {
        throw "Copy to one or more machine failed."
    }
    else
    {
        Write-Output "Copied files from source path: $sourcePath to target azure vms in environment: $environmentName successfully." -Verbose
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