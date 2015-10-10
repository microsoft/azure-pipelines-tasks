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
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose

# keep machineNames parameter name unchanged due to back compatibility
$machineFilter = $machineNames

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

function ThrowError
{
    param([string]$errorMessage)

    $readmelink = "http://aka.ms/azurefilecopyreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

function Does-RequireSwitchAzureMode
{
    $azureVersion = Get-AzureCmdletsVersion

    $versionToCompare = New-Object -TypeName System.Version -ArgumentList "0.9.9"

    $result = Get-AzureVersionComparison -AzureVersion $azureVersion -CompareVersion $versionToCompare
	
	if(!$result)
	{
	    Write-Verbose "Switch Azure mode is required." -Verbose
	}
	else
	{
	    Write-Verbose "Switch Azure mode is not required." -Verbose
	}

    return !$result
}

function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    try
    {
        Write-Verbose "[Azure Call](ARM)Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose
        $azureStorageAccountResourceDetails = Get-AzureRMResource -ResourceName $storageAccountName | Where-Object { $_.ResourceType -eq $ARMStorageAccountResourceType }
        Write-Verbose "[Azure Call](ARM)Retrieved resource details successfully for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose

        $azureResourceGroupName = $azureStorageAccountResourceDetails.ResourceGroupName
    }
    finally
    {
        if ([string]::IsNullOrEmpty($azureResourceGroupName) -eq $true)
        {
            Write-Verbose "(ARM)Storage account: $storageAccountName not found" -Verbose
            Throw (Get-LocalizedString -Key "Storage acccout: {0} not found. Please specify existing storage account" -ArgumentList $storageAccountName)
        }  
    }

    return $azureStorageAccountResourceDetails.ResourceGroupName
}

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName)

    # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureStorageAccountResourceGroupName -storageAccountName $storageAccountName

    Write-Verbose "[Azure Call](ARM)Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose
    $storageKeyDetails = Get-AzureRMStorageAccountKey -ResourceGroupName $azureResourceGroupName -Name $storageAccount 
    $storageKey = $storageKeyDetails.Key1
    Write-Verbose "[Azure Call](ARM)Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose

    return $storageKey
}

function Get-AzureStorageKeyFromRDFE
{
    param([string]$storageAccountName)

    Write-Verbose "[Azure Call](RDFE)Retrieving storage key for the storage account: $storageAccount" -Verbose
    $storageKeyDetails = Get-AzureStorageKey -StorageAccountName $storageAccountName
    $storageKey = $storageKeyDetails.Primary
    Write-Verbose "[Azure Call](RDFE)Retrieved storage key successfully for the storage account: $storageAccount" -Verbose

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

    Write-Verbose "[Azure Call]Deleting container: $containerName in storage account: $storageAccount" -Verbose
    Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
    Write-Verbose "[Azure Call]Deleted container: $containerName in storage account: $storageAccount" -Verbose
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
    $resourceId = $resource.Id

    Write-Verbose "`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose
    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceId $resourceId
    Write-Verbose "`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose
    Write-Verbose "`t Resource fqdn - $fqdn" -Verbose

    $winrmPortToUse = ''
    $protocolToUse = ''

    # check whether https port is defined for resource
    Write-Verbose "`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose
    $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceId $resourceId
    Write-Verbose "`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose

    if ([string]::IsNullOrEmpty($winrmHttpsPort))
    {
        Write-Verbose "`t Resource: $resourceName (Id : $resourceId) does not have any winrm https port defined, checking for winrm http port" -Verbose

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose
        $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose

        # if resource does not have any port defined then, use https port by default
        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
            Write-Verbose "`t Resource: $resourceName (Id : $resourceId) does not have any winrm http port or https port defined, using https port by default" -Verbose
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
    $resourceProperties.displayName = $fqdn + ":" + $winrmPortToUse

    return $resourceProperties
}

function Get-SkipCACheckOption
{
    param([string]$environmentName,
          [Microsoft.VisualStudio.Services.Client.VssConnection]$connection)

    $skipCACheckOption = $doSkipCACheckOption

    # get skipCACheck option from environment
    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose
    $skipCACheckBool = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $skipCACheckKeyName -Connection $connection
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose

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
        $resourceId = $resource.Id
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)" -Verbose

        # Get other connection details for resource like - Fqdn WinRM Port, Http Protocol, SkipCACheck Option, Resource Credentials
        $resourceProperties = Get-ResourceConnectionDetails -resource $resource -connection $connection
        $resourceProperties.skipCACheckOption = $skipCACheckOption

        $resourcesPropertyBag.Add($resourceId, $resourceProperties)
    }

    return $resourcesPropertyBag
}

function Get-WellFormedTagsList
{
    [CmdletBinding()]
    Param
    (
        [string]$tagsListString
    )

    if([string]::IsNullOrWhiteSpace($tagsListString))
    {
        return $null
    }

    $tagsArray = $tagsListString.Split(';')
    $tagList = New-Object 'System.Collections.Generic.List[Tuple[string,string]]'
    foreach($tag in $tagsArray)
    {
        if([string]::IsNullOrWhiteSpace($tag)) {continue}
        $tagKeyValue = $tag.Split(':')
        if($tagKeyValue.Length -ne 2)
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        if([string]::IsNullOrWhiteSpace($tagKeyValue[0]) -or [string]::IsNullOrWhiteSpace($tagKeyValue[1]))
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        $tagTuple = New-Object "System.Tuple[string,string]" ($tagKeyValue[0].Trim(), $tagKeyValue[1].Trim())
        $tagList.Add($tagTuple) | Out-Null
    }

    $tagList = [System.Collections.Generic.IEnumerable[Tuple[string,string]]]$tagList
    return ,$tagList
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

$isSwitchAzureModeRequired = Does-RequireSwitchAzureMode

if($isSwitchAzureModeRequired)
{
    Write-Verbose "Azure Powershell commandlet version is less than 0.9.9" -Verbose
    . ./AzureResourceManagerWrapper.ps1
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
	. ./AzureResourceManagerWrapper.ps1
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

# uploading files to container
$sourcePath = $sourcePath.Trim('"')
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
    $errorMessage = (Get-LocalizedString -Key "Upload to container: '{0}' in storage account: '{1}' with blobprefix: '{2}' failed with error: '{3}'" -ArgumentList $containerName, $storageAccount, $blobPrefix, $error)
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
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    if($resourceFilteringMethod -eq "tags")
    {
        $wellFormedTagsList = Get-WellFormedTagsList -tagsListString $machineFilter

        Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with tag filter: $wellFormedTagsList" -Verbose
        $resources = Get-EnvironmentResources -EnvironmentName $environmentName -TagFilter $wellFormedTagsList -Connection $connection
        Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with tag filter" -Verbose
    }
    else
    {
        Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with machine filter: $machineFilter" -Verbose
        $resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineFilter -Connection $connection
        Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with machine filter" -Verbose
    }

    if ($resources.Count -eq 0)
    {
        throw (Get-LocalizedString -Key "No machine exists under environment: '{0}' for copy" -ArgumentList $environmentName)
    }

    Write-Verbose "Starting Invoke-EnvironmentOperation cmdlet call on environment name: $environmentName with operation name: $azureFileCopyOperation" -Verbose
    $envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName $azureFileCopyOperation -Connection $connection
    Write-Verbose "Completed Invoke-EnvironmentOperation cmdlet call on environment name: $environmentName with operation name: $deploymentOperation" -Verbose
    Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose

    $resourcesPropertyBag = Get-ResourcesProperties -resources $resources -connection $connection

    # create container sas token with full permissions
    Write-Verbose "[Azure Call]Generating SasToken for container: $containerName in storage: $storageAccount with expiry time: $defaultSasTokenTimeOutInHours hours" -Verbose
    $containerSasToken = New-AzureStorageContainerSASToken -Name $containerName -ExpiryTime (Get-Date).AddHours($defaultSasTokenTimeOutInHours) -Context $storageContext -Permission rwdl
    Write-Verbose "[Azure Call]Generated SasToken: $containerSasToken successfully for container: $containerName in storage: $storageAccount" -Verbose

    # copies files sequentially
    if ($copyFilesInParallel -eq "false" -or ( $resources.Count -eq 1 ))
    {
        foreach ($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
            $machine = $resourceProperties.fqdn
            $displayName = $resourceProperties.displayName

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $displayName)

            $copyResponse = Invoke-Command -ScriptBlock $AzureFileCopyJob -ArgumentList $machine, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption, $enableDetailedLoggingString
            $status = $copyResponse.Status

            Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $displayName -deploymentResponse $copyResponse
            Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)

            if ($status -ne "Passed")
            {
                Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: Failed" -Verbose
                Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection
                Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: Failed" -Verbose

                Write-Verbose $copyResponse.Error.ToString() -Verbose
                $errorMessage =  $copyResponse.Error.Message
                ThrowError -errorMessage $errorMessage
            }
        }
    }
    # copies files parallely
    else
    {
        [hashtable]$Jobs = @{}
        foreach ($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
            $machine = $resourceProperties.fqdn
            $displayName = $resourceProperties.displayName

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $displayName)

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
                    $displayName = $Jobs.Item($job.Id).displayName
                    $resOperationId = $Jobs.Item($job.Id).resOperationId

                    Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $displayName -deploymentResponse $output
                    Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)

                    if ($status -ne "Passed")
                    {
                        $envOperationStatus = "Failed"
                    $errorMessage = ""
                    if($output.Error -ne $null)
                    {
                        $errorMessage = $output.Error.Message
                    }
                        Write-Output (Get-LocalizedString -Key "Copy failed on machine '{0}' with following message : '{1}'" -ArgumentList $displayName, $errorMessage)
                    }
                }
            }
        }
    }

     Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose
     Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection
     Write-Verbose "Completed Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose

    if ($envOperationStatus -ne "Passed")
    {
        $errorMessage = (Get-LocalizedString -Key 'Copy to one or more machines failed.')
        ThrowError -errorMessage $errorMessage
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