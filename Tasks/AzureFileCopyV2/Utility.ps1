# Utility Functions used by AzureFileCopy.ps1 (other than azure calls) #

$ErrorActionPreference = 'Stop'
$azureStackEnvironment = "AzureStack"
$jobId = $env:SYSTEM_JOBID;

function Get-AzureCmdletsVersion
{
    $module = Get-Module AzureRM -ListAvailable
    if($module)
    {
        return ($module).Version
    }
    return (Get-Module Azure -ListAvailable).Version
}

function Get-AzureVersionComparison($azureVersion, $compareVersion)
{
    Write-Verbose "Compare azure versions: $azureVersion, $compareVersion"
    return ($azureVersion -and $azureVersion -gt $compareVersion)
}

function Get-AzureUtility
{
    param([string][Parameter(Mandatory=$true)]$connectedServiceName)

    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose "Installed Azure PowerShell version: $currentVersion"

    $AzureVersion099 = New-Object System.Version(0, 9, 9)
    $AzureVersion103 = New-Object System.Version(1, 0, 3)
    $AzureVersion132 = New-Object System.Version(1, 3, 2)

    $azureUtilityVersion098 = "AzureUtilityLTE9.8.ps1"
    $azureUtilityVersion100 = "AzureUtilityGTE1.0.ps1"
    $azureUtilityVersion110 = "AzureUtilityGTE1.1.0.ps1"
	$azureUtilityRest100 = "AzureUtilityRest.ps1"

    if(!(Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $AzureVersion099))
    {
		return $azureUtilityVersion098
    }
	
    if(!(Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $AzureVersion103))
    {
		return $azureUtilityVersion100
    }
	
	$connectionType = Get-TypeOfConnection $connectedServiceName
	if(!(Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $AzureVersion132) -or ($connectionType -eq "UserNamePassword"))
    {
        return $azureUtilityVersion110
    }
	
    return $azureUtilityRest100
}

function Get-TypeOfConnection
{
    param([string][Parameter(Mandatory=$true)]$connectedServiceName)

    $serviceEndpoint = Get-VstsEndpoint -Name "$connectedServiceName"
    $connectionType = $serviceEndpoint.Auth.Scheme

    Write-Verbose "Connection type used is $connectionType"
    return $connectionType
}


function Get-Endpoint
{
    param([String] [Parameter(Mandatory=$true)] $connectedServiceName)

    $serviceEndpoint = Get-VstsEndpoint -Name "$connectedServiceName"
    return $serviceEndpoint
}

function Validate-AzurePowershellVersion
{
    Write-Verbose "Validating minimum required azure powershell version is greater than or equal to 0.9.0"

    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose "Installed Azure PowerShell version: $currentVersion"

    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Write-Telemetry "Task_InternalError" "UnsupportedAzurePSVersion"
        Throw (Get-VstsLocString -Key "AFC_AzurePSNotInstalled" -ArgumentList $minimumAzureVersion)
    }

    Write-Verbose "Validated the required azure powershell version is greater than or equal to 0.9.0"
}

function Get-StorageKey
{
    param([string][Parameter(Mandatory=$true)]$storageAccountName,
        [string][Parameter(Mandatory=$true)]$connectionType,
        [string][Parameter(Mandatory=$true)]$connectedServiceName,
        [string][Parameter(Mandatory=$false)]$vstsAccessToken)

    $serviceEndpoint = Get-Endpoint $connectedServiceName
    $storageAccountName = $storageAccountName.Trim()
    if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
    {
        try
        {
            # getting storage key from RDFE
            $storageKey = Get-AzureStorageKeyFromRDFE -storageAccountName $storageAccountName -endpoint $serviceEndpoint
        }
        catch [Hyak.Common.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "[Azure Call](RDFE) ExceptionMessage: $exceptionMessage"

            if($connectionType -eq 'Certificate')
            {
                Write-Telemetry "Task_InternalError" "ClassicStorageAccountNotFound"                
                Throw (Get-VstsLocString -Key "AFC_ClassicStorageAccountNotFound" -ArgumentList $storageAccountName)
            }
            # Since authentication is UserNamePassword we will check whether storage is non-classic
            # Bug: We are validating azureps version to be atleast 0.9.0 though it is not required if user working on classic resources
            else
            {
                try
                {
                    # checking azure powershell version to make calls to ARM endpoint
                    Validate-AzurePowershellVersion

                    # getting storage account key from ARM endpoint
                    $storageKey = Get-AzureStorageKeyFromARM -storageAccountName $storageAccountName -serviceEndpoint $serviceEndpoint
                }
                catch
                {
                    #since authentication was UserNamePassword so we cant suggest user whether storage should be classic or non-classic
                    Write-Telemetry "Task_InternalError" "StorageAccountNotFound"
                    Throw (Get-VstsLocString -Key "AFC_GenericStorageAccountNotFound" -ArgumentList $storageAccountName)
                }
            }
        }
    }
    else
    {
        # checking azure powershell version to make calls to ARM endpoint
        Validate-AzurePowershellVersion

        # getting storage account key from ARM endpoint
        $storageKey = Get-AzureStorageKeyFromARM -storageAccountName $storageAccountName -serviceEndpoint $serviceEndpoint `
            -connectedServiceNameARM $connectedServiceName $vstsAccessToken
    }

    return $storageKey
}

function Get-blobStorageEndpoint
{
    param([string][Parameter(Mandatory=$true)]$storageAccountName,
        [string][Parameter(Mandatory=$true)]$connectionType,
        [string][Parameter(Mandatory=$true)]$connectedServiceName,
        [string][Parameter(Mandatory=$false)]$vstsAccessToken)

    $endpoint = Get-Endpoint $connectedServiceName
    $storageAccountName = $storageAccountName.Trim()
    if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
    {
        try
        {
            # getting storage key from RDFE
            $blobStorageEndpoint = Get-AzureBlobStorageEndpointFromRDFE -storageAccountName $storageAccountName -endpoint $endpoint
        }
        catch [Hyak.Common.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "[Azure Call](RDFE) ExceptionMessage: $exceptionMessage"
            Write-Telemetry "Task_InternalError" "StorageAccountNotFound"
            Throw (Get-VstsLocString -Key "AFC_BlobStorageNotFound" -ArgumentList $storageAccountName)
        }
    }
    else
    {
        # getting storage account key from ARM endpoint
        $blobStorageEndpoint = Get-AzureBlobStorageEndpointFromARM $storageAccountName $endpoint $connectedServiceName $vstsAccessToken
    }

    return $blobStorageEndpoint
}

function Get-StorageAccountType
{
    param([string][Parameter(Mandatory=$true)]$storageAccountName,
        [string][Parameter(Mandatory=$true)]$connectionType,
        [string][Parameter(Mandatory=$true)]$connectedServiceName,
        [string][Parameter(Mandatory=$false)]$vstsAccessToken)

    $endpoint = Get-Endpoint $connectedServiceName
    $storageAccountName = $storageAccountName.Trim()
    if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
    {
        try
        {
            # getting storage account type from RDFE
            $storageAccountType = Get-AzureStorageAccountTypeFromRDFE -storageAccountName $storageAccountName -endpoint $endpoint
        }
        catch [Hyak.Common.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "[Azure Call](RDFE) ExceptionMessage: $exceptionMessage"
            Write-Telemetry "Task_InternalError" "StorageAccountNotFound"
            Throw (Get-VstsLocString -Key "AFC_BlobStorageNotFound" -ArgumentList $storageAccountName)
        }
    }
    else
    {
        # getting storage account type from ARM endpoint
        $storageAccountType = Get-AzureStorageAccountTypeFromARM $storageAccountName $endpoint $connectedServiceName $vstsAccessToken
    }

	if($null -ne $storageAccountType)
    {
        return $storageAccountType.ToString()
    }
}

function ThrowError
{
    param([string]$errorMessage)

    $readmelink = "https://aka.ms/azurefilecopyreadme"
    $helpMessage = (Get-VstsLocString -Key "AFC_AzureFileCopyMoreHelp" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

function Upload-FilesToAzureContainer
{
    param([string][Parameter(Mandatory=$true)]$sourcePath,
          [string][Parameter(Mandatory=$true)]$storageAccountName,
          [string][Parameter(Mandatory=$true)]$containerName,
          [string]$blobPrefix,
		  [string]$blobStorageEndpoint,
          [string][Parameter(Mandatory=$true)]$storageKey,
          [string][Parameter(Mandatory=$true)]$azCopyLocation,
          [string]$additionalArguments,
          [string][Parameter(Mandatory=$true)]$destinationType,
          [bool]$useDefaultArguments,
          [string]$azCopyLogFilePath
    )

    try
    {
        Write-Output (Get-VstsLocString -Key "AFC_UploadFilesStorageAccount" -ArgumentList $sourcePath, $storageAccountName, $containerName, $blobPrefix)

        $resolvedSourcePath = $sourcePath

        # Check if source path is a file. If yes, then add /Pattern additional argument.
        if(Test-Path -Path $sourcePath -PathType Leaf)
        {
            $fileInfo = Get-Item $sourcePath
            $resolvedSourcePath = $fileInfo.Directory.FullName
            $additionalArguments += " /Pattern:`"$($fileInfo.Name)`""
        }

        $blobPrefix = $blobPrefix.Trim()
        $containerURL = [string]::Format("{0}/{1}/{2}", $blobStorageEndpoint.Trim("/"), $containerName, $blobPrefix).Trim("/")
        $containerURL = $containerURL.Replace('$','`$')
        $azCopyExeLocation = Join-Path -Path $azCopyLocation -ChildPath "AzCopy.exe"
        $responseFile = Get-VstsTaskVariable -Name "VSTS_TASKVARIABLE_AFC_V2_ARM_STORAGE_KEY_FILE"
        if ([string]::IsNullOrEmpty($responseFile) -or !(Test-Path -Path $responseFile -PathType Leaf)) {
            Write-Verbose 'Creating response file'
            $responseFile = Join-Path -Path (Get-VstsTaskVariable -Name 'Agent.TempDirectory') -ChildPath ([Guid]::NewGuid().ToString())
            $responseFileContents = " /DestKey:`"$storageKey`" "
            [System.IO.File]::WriteAllText(
                $responseFile,
                $responseFileContents,
                [System.Text.Encoding]::UTF8
            )
        }

        Write-Output "##[command] & `"$azCopyExeLocation`" /Source:`"$resolvedSourcePath`" /Dest:`"$containerURL`" /@:`"$responseFile`" $additionalArguments"

        $uploadToBlobCommand = "& `"$azCopyExeLocation`" /Source:`"$resolvedSourcePath`" /Dest:`"$containerURL`" /@:`"$responseFile`" $additionalArguments"

        Invoke-Expression $uploadToBlobCommand

        if($LASTEXITCODE -eq 0)
        {
            Write-Output (Get-VstsLocString -Key "AFC_UploadFileSuccessful" -ArgumentList $sourcePath, $storageAccountName, $containerName, $blobPrefix)
        }
        else
        {
            throw (Get-VstsLocString -Key "AFC_AzCopyBlobUploadNonZeroExitCode")
        }
    }
    catch
    {
        # deletes container only if we have created temporary container
        if ($destinationType -ne "AzureBlob")
        {
            Remove-AzureContainer -containerName $containerName -storageContext $storageContext
        }

        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "ExceptionMessage: $exceptionMessage"

        $errorMessage = (Get-VstsLocString -Key "AFC_UploadContainerStorageAccount" -ArgumentList $containerName, $storageAccountName, $blobPrefix, $exceptionMessage)
        Write-Telemetry "Task_InternalError" "BlobUploadFailed"
        ThrowError -errorMessage $errorMessage
    }
    finally
    {
        Handle-AzCopyLogs -isLogsPresent $useDefaultArguments -logsFilePath $azCopyLogFilePath -ErrorAction SilentlyContinue
        Remove-Item -Path $responseFile -Force -ErrorAction 'SilentlyContinue'
    }
}

function Handle-AzCopyLogs
{
    [CmdletBinding()]
    param(
        [Nullable[bool]]$isLogsPresent,
        [AllowEmptyString()][string]$logsFilePath
    )

    if($isLogsPresent)
    {
        Get-Content -Path $logsFilePath | Out-String | Write-Verbose
        Remove-Item $logsFilePath
    }
}

function Does-AzureVMMatchTagFilterCriteria
{
    param([object]$azureVMResource,
          [string]$filter)

    if($azureVMResource)
    {
        # If no filters are provided, by default operations are performed on all azure resources
        if([string]::IsNullOrEmpty($filter))
        {
            return $true
        }

        $tagsFilterArray = $filter.Split(';').Trim()
        foreach($tag in $tagsFilterArray)
        {
            $tagKeyValue = $tag.Split(':').Trim()
            $tagKey =  $tagKeyValue[0]
            $tagValues = $tagKeyValue[1]

            if($tagKeyValue.Length -ne 2 -or [string]::IsNullOrWhiteSpace($tagKey) -or [string]::IsNullOrWhiteSpace($tagValues))
            {
                Write-Telemetry "Input_Validation" "FILTERING_IncorrectFormat"
                throw (Get-VstsLocString -Key "AFC_IncorrectTags")
            }

            $tagValueArray = $tagValues.Split(',').Trim()

            if($azureVMResource.Tags)
            {
                foreach($azureVMResourceTag in $azureVMResource.Tags.GetEnumerator())
                {
                    if($azureVMResourceTag.Key -contains $tagKey)
                    {
                        $azureVMTagValueArray = $azureVMResourceTag.Value.Split(",").Trim()
                        foreach($tagValue in $tagValueArray)
                        {
                            if($azureVMTagValueArray -contains $tagValue)
                            {
                                return $true
                            }
                        }
                    }
                }
            }
        }

        return $false
    }
}

function Get-TagBasedFilteredAzureVMs
{
    param([object]$azureVMResources,
          [string]$filter)

    if($azureVMResources)
    {
        $filteredAzureVMResources = @()
        foreach($azureVMResource in $azureVMResources)
        {
            if(Does-AzureVMMatchTagFilterCriteria -azureVMResource $azureVMResource -filter $filter)
            {
                Write-Verbose "azureVM with name: $($azureVMResource.Name) matches filter criteria"
                $filteredAzureVMResources += $azureVMResource
            }
        }

        return $filteredAzureVMResources
    }
}

function Get-MachineBasedFilteredAzureVMs
{
    param([object]$azureVMResources,
          [string]$filter)

    if($azureVMResources -and -not [string]::IsNullOrEmpty($filter))
    {
        $filteredAzureVMResources = @()

        $machineFilterArray = $filter.Split(',').Trim()
        $machineFilterArray = $machineFilterArray | % {$_.ToLower()} | Select -Uniq
        foreach($machine in $machineFilterArray)
        {
            $azureVMResource = $azureVMResources | Where-Object {$_.Name -contains $machine}
            if($azureVMResource)
            {
                $filteredAzureVMResources += $azureVMResource
            }
            else
            {
                $commaSeparatedMachinesNotPresentInRG += ($(if($commaSeparatedMachinesNotPresentInRG){", "}) + $machine)
            }

            if($commaSeparatedMachinesNotPresentInRG -ne $null)
            {
                Write-Telemetry "Input_Validation" "FILTERING_MachinesNotPresentInRG"
                throw (Get-VstsLocString -Key "AFC_MachineDoesNotExist" -ArgumentList $commaSeparatedMachinesNotPresentInRG)
            }
        }

        return $filteredAzureVMResources
    }
}

function Get-FilteredAzureVMsInResourceGroup
{
    param([object]$azureVMResources,
          [string]$resourceFilteringMethod,
          [string]$filter)

    if($azureVMResources -and -not [string]::IsNullOrEmpty($resourceFilteringMethod))
    {
        if($resourceFilteringMethod -eq "tags" -or [string]::IsNullOrEmpty($filter))
        {
            $filteredAzureVMResources = Get-TagBasedFilteredAzureVMs -azureVMResources $azureVMResources -filter $filter
        }
        else
        {
            $filteredAzureVMResources = Get-MachineBasedFilteredAzureVMs -azureVMResources $azureVMResources -filter $filter
        }

        return $filteredAzureVMResources
    }
}

function Get-FilteredAzureClassicVMsInResourceGroup
{
    param([object]$azureClassicVMResources,
          [string]$resourceFilteringMethod,
          [string]$filter)

    if($azureClassicVMResources -and -not [string]::IsNullOrEmpty($resourceFilteringMethod))
    {
        Write-Verbose "Filtering azureClassicVM resources with filtering option:'$resourceFilteringMethod' and filters:'$filter'"
        $filteredAzureClassicVMResources = Get-FilteredAzureVMsInResourceGroup -azureVMResources $azureClassicVMResources -resourceFilteringMethod $resourceFilteringMethod -filter $filter

        return $filteredAzureClassicVMResources
    }
}

function Get-FilteredAzureRMVMsInResourceGroup
{
    param([object]$azureRMVMResources,
          [string]$resourceFilteringMethod,
          [string]$filter)

    if($azureRMVMResources -and -not [string]::IsNullOrEmpty($resourceFilteringMethod))
    {
        Write-Verbose "Filtering azureRMVM resources with filtering option:$resourceFilteringMethod and filters:$filter"
        $filteredAzureRMVMResources = Get-FilteredAzureVMsInResourceGroup -azureVMResources $azureRMVMResources -resourceFilteringMethod $resourceFilteringMethod -filter $filter

        return $filteredAzureRMVMResources
    }
}

function Get-MachineNameFromId
{
    param([string]$resourceGroupName,
          [System.Collections.Hashtable]$map,
          [string]$mapParameter,
          [Object]$azureRMVMResources,
          [boolean]$throwOnTotalUnavailability,
          [string]$debugLogsFlag)

    if($map)
    {
        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "Map for $mapParameter : " -verbose
            Write-Verbose ($map | Format-List | Out-String) -verbose

            Write-Verbose "azureRMVMResources: " -verbose
            Write-Verbose ($azureRMVMResources | Format-List | Out-String) -verbose
        }

        Write-Verbose "throwOnTotalUnavailability: $throwOnTotalUnavailability"

        $errorCount = 0
        foreach($vm in $azureRMVMResources)
        {
            $value = $map[$vm.Id.ToLower()]
            $resourceName = $vm.Name
            if(-not [string]::IsNullOrEmpty($value))
            {
                Write-Verbose "$mapParameter value for resource $resourceName is $value"
                $map.Remove($vm.Id.ToLower())
                $map[$resourceName] = $value
            }
            else
            {
                $errorCount = $errorCount + 1
                Write-Verbose "Unable to find $mapParameter for resource $resourceName"
            }
        }

        if($throwOnTotalUnavailability -eq $true)
        {
            if($errorCount -eq $azureRMVMResources.Count -and $azureRMVMResources.Count -ne 0)
            {
                throw (Get-VstsLocString -Key "AFC_MachineNameFromIdErrorAllResources" -ArgumentList $mapParameter, $resourceGroupName)
            }
            else
            {
                if($errorCount -gt 0 -and $errorCount -ne $azureRMVMResources.Count)
                {
                    Write-Warning (Get-VstsLocString -Key "AFC_MachineNameFromIdError" -ArgumentList $mapParameter, $errorCount, $resourceGroupName)
                }
            }
        }

        return $map
    }
}

function Get-MachinesFqdnsForPublicIP
{
    param([string]$resourceGroupName,
          [Object]$publicIPAddressResources,
          [Object]$networkInterfaceResources,
          [Object]$azureRMVMResources,
          [System.Collections.Hashtable]$fqdnMap,
          [string]$debugLogsFlag)

    if(-not [string]::IsNullOrEmpty($resourceGroupName)-and $publicIPAddressResources -and $networkInterfaceResources)
    {
        Write-Verbose "Trying to get FQDN for the azureRM VM resources under public IP from resource Group $resourceGroupName" 

        #Map the ipc to the fqdn
        foreach($publicIp in $publicIPAddressResources)
        {
            if(-not [string]::IsNullOrEmpty($publicIp.IpConfiguration.Id))
            {   
                $publicIPKey = $publicIp.IpConfiguration.Id.ToLower()
                Write-Verbose "Adding entry to FQDN map with key $publicIPKey" 

                if(-not [string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn))
                {
                    Write-Verbose "Inserting to FQDN map with value (FQDN) : $publicIPKey" 
                    $fqdnMap[$publicIPKey] =  $publicIP.DnsSettings.Fqdn
                }
                elseif(-not [string]::IsNullOrEmpty($publicIP.IpAddress))
                {
                    Write-Verbose "Inserting to FQDN map with value (IP Address) : $publicIPKey" 
                    $fqdnMap[$publicIPKey] =  $publicIP.IpAddress
                }
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "fqdnMap for MachinesFqdnsForPublicIP after mapping ip configuration to fqdn: " -Verbose
            Write-Verbose ($fqdnMap | Format-List | Out-String) -Verbose
        }

        #Find out the NIC, and thus the VM corresponding to a given ipc
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                $fqdn =  $fqdnMap[$ipc.Id.ToLower()]
                if(-not [string]::IsNullOrEmpty($fqdn))
                {
                    $fqdnMap.Remove($ipc.Id.ToLower())
                    if($nic.VirtualMachine)
                    {
                        $vmId = $nic.VirtualMachine.Id.ToLower()
                        Write-Verbose "Adding entry to FQDN map with key $vmId"
                        $fqdnMap[$vmId] = $fqdn
                    }
                }
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "final fqdnMap for MachinesFqdnsForPublicIP after finding vm id corresponding to ip configuration: " -Verbose
            Write-Verbose ($fqdnMap | Format-List | Out-String) -Verbose
        }
    }

    Write-Verbose "Got FQDN for the azureRM VM resources under public IP from resource Group $resourceGroupName"

    return $fqdnMap
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName,
          [Object]$publicIPAddressResources,
          [Object]$networkInterfaceResources,
          [Object]$frontEndIPConfigs,
          [System.Collections.Hashtable]$fqdnMap,
          [string]$debugLogsFlag)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $publicIPAddressResources -and $networkInterfaceResources -and $frontEndIPConfigs)
    {
        Write-Verbose "Trying to get FQDN for the RM azureVM resources under load balancer from resource group: $resourceGroupName"

        #Map the public ip id to the fqdn
        foreach($publicIp in $publicIPAddressResources)
        {
            if(-not [string]::IsNullOrEmpty($publicIp.IpConfiguration.Id))
            {
                if(-not [string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn))
                {
                    $fqdnMap[$publicIp.Id.ToLower()] =  $publicIP.DnsSettings.Fqdn
                }
                elseif(-not [string]::IsNullOrEmpty($publicIP.IpAddress))
                {
                    $fqdnMap[$publicIp.Id.ToLower()] =  $publicIP.IpAddress
                }
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "fqdnMap for MachinesFqdnsForLB after mapping ip configuration to fqdn: " -Verbose
            Write-Verbose ($fqdnMap | Format-List | Out-String) -Verbose
        }

        #Get the NAT rule for a given ip id
        foreach($config in $frontEndIPConfigs)
        {
            if(-not [string]::IsNullOrEmpty($config.PublicIpAddress.Id))
            {
                $fqdn = $fqdnMap[$config.PublicIpAddress.Id.ToLower()]
                if(-not [string]::IsNullOrEmpty($fqdn))
                {
                    $fqdnMap.Remove($config.PublicIpAddress.Id.ToLower())
                    foreach($rule in $config.InboundNatRules)
                    {
                        $fqdnMap[$rule.Id.ToLower()] =  $fqdn
                    }
                }
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "fqdnMap for MachinesFqdnsForLB after getting NAT rule for given ip configuration: " -Verbose
            Write-Verbose ($fqdnMap | Format-List | Out-String) -Verbose
        }

        #Find out the NIC, and thus the corresponding machine to which the NAT rule belongs
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                foreach($rule in $ipc.LoadBalancerInboundNatRules)
                {
                    $fqdn = $fqdnMap[$rule.Id.ToLower()]
                    if(-not [string]::IsNullOrEmpty($fqdn))
                    {
                        $fqdnMap.Remove($rule.Id.ToLower())
                        if($nic.VirtualMachine)
                        {
                            $fqdnMap[$nic.VirtualMachine.Id.ToLower()] = $fqdn
                        }
                    }
                }
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "final fqdnMap for MachinesFqdnsForLB after getting vm id corresponding to NAT rule for given ip configuration: " -Verbose
            Write-Verbose ($fqdnMap | Format-List | Out-String) -Verbose
        }
    }

    Write-Verbose "Got FQDN for the RM azureVM resources under load balancer from resource Group $resourceGroupName"

    return $fqdnMap
}

function Get-FrontEndPorts
{
    param([string]$backEndPort,
          [System.Collections.Hashtable]$portList,
          [Object]$networkInterfaceResources,
          [Object]$inboundRules,
          [string]$debugLogsFlag)

    if(-not [string]::IsNullOrEmpty($backEndPort) -and $networkInterfaceResources -and $inboundRules)
    {
        Write-Verbose "Trying to get front end ports for $backEndPort"

        $filteredRules = $inboundRules | Where-Object {$_.BackendPort -eq $backEndPort}

        #Map front end port to back end ipc
        foreach($rule in $filteredRules)
        {
            if($rule.BackendIPConfiguration)
            {
                $portList[$rule.BackendIPConfiguration.Id.ToLower()] = $rule.FrontendPort
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "portList for FrontEndPorts after mapping front end port to backend ip configuration: " -Verbose
            Write-Verbose ($portList | Format-List | Out-String) -Verbose
        }

        #Get the nic, and the corresponding machine id for a given back end ipc
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipConfig in $nic.IpConfigurations)
            {
                $frontEndPort = $portList[$ipConfig.Id.ToLower()]
                if(-not [string]::IsNullOrEmpty($frontEndPort))
                {
                    $portList.Remove($ipConfig.Id.ToLower())
                    if($nic.VirtualMachine)
                    {
                        $portList[$nic.VirtualMachine.Id.ToLower()] = $frontEndPort
                    }
                }
            }
        }

        if($debugLogsFlag -eq "true")
        {
            Write-Verbose "portList for FrontEndPorts after getting vm id corresponding to given backend ip configuration, after finding nic: " -Verbose
            Write-Verbose ($portList | Format-List | Out-String) -Verbose
        }
    }
    
    Write-Verbose "Got front end ports for $backEndPort"
    return $portList
}

function Get-AzureRMVMsConnectionDetailsInResourceGroup
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources,
          [string]$enableCopyPrerequisites,
          [string]$connectedServiceName,
          [string]$vstsAccessToken)

    [hashtable]$fqdnMap = @{}
    $winRMHttpsPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
    [hashtable]$azureRMVMsDetails = @{}
    $debugLogsFlag= $env:system_debug

    # Getting endpoint used for the task
    if($connectedServiceName)
    {
        $endpoint = Get-Endpoint -connectedServiceName $connectedServiceName
    }
    
    $isAzureStackEnvironment = $false
    if($endpoint -and $endpoint.Data -and $endpoint.Data.Environment) {
        $environmentName = $Endpoint.Data.Environment
        if($environmentName -eq $azureStackEnvironment)
        {
            $isAzureStackEnvironment = $true
        }
    }

    if (-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureRMVMResources)
    {

        if($isAzureStackEnvironment)
        {
            Write-Verbose "Fetching resource group resources details for Azure Stack environment."
            $azureRGResourcesDetails = Get-AzureRMResourceGroupResourcesDetailsForAzureStack -resourceGroupName $resourceGroupName `
                -azureRMVMResources $azureRMVMResources -endpoint $endpoint -connectedServiceNameARM $connectedServiceName -vstsAccessToken $vstsAccessToken
        }
        else
        {
            Write-Verbose "Fetching resource group resources details for Azure/National cloud environments."
            $azureRGResourcesDetails = Get-AzureRMResourceGroupResourcesDetails -resourceGroupName $resourceGroupName -azureRMVMResources $azureRMVMResources
        }

        $networkInterfaceResources = $azureRGResourcesDetails["networkInterfaceResources"]
        $publicIPAddressResources = $azureRGResourcesDetails["publicIPAddressResources"]
        $loadBalancerResources = $azureRGResourcesDetails["loadBalancerResources"]

        if($loadBalancerResources)
        {
            foreach($lbName in $loadBalancerResources.Keys)
            {
                $lbDetails = $loadBalancerResources[$lbName]
                $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
                $inboundRules = $lbDetails["inboundRules"]

                $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources `
                                                  -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap -debugLogsFlag $debugLogsFlag
                $winRMHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRMHttpsPortMap -networkInterfaceResources $networkInterfaceResources `
                                                       -inboundRules $inboundRules -debugLogsFlag $debugLogsFlag
            }

            $winRMHttpsPortMap = Get-MachineNameFromId -Map $winRMHttpsPortMap -MapParameter "Front End port" -azureRMVMResources $azureRMVMResources `
                                                       -throwOnTotalUnavailability $false -debugLogsFlag $debugLogsFlag
        }

        $fqdnMap = Get-MachinesFqdnsForPublicIP -resourceGroupName $resourceGroupName -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources `
                                                -azureRMVMResources $azureRMVMResources -fqdnMap $fqdnMap -debugLogsFlag $debugLogsFlag
        $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -azureRMVMResources $azureRMVMResources `
                                         -throwOnTotalUnavailability $true -debugLogsFlag $debugLogsFlag

        foreach ($resource in $azureRMVMResources)
        {
            $resourceName = $resource.Name
            $resourceId = $resource.Id
            $resourceFQDN = $fqdnMap[$resourceName]
            $resourceWinRMHttpsPort = $winRMHttpsPortMap[$resourceName]
            if([string]::IsNullOrWhiteSpace($resourceWinRMHttpsPort))
            {
                Write-Verbose "Defaulting WinRmHttpsPort of $resourceName to 5986"
                $resourceWinRMHttpsPort = "5986"
            }

            $resourceProperties = @{}
            $resourceProperties.Name = $resourceName
            $resourceProperties.fqdn = $resourceFQDN
            $resourceProperties.winRMHttpsPort = $resourceWinRMHttpsPort

            $azureRMVMsDetails.Add($resourceName, $resourceProperties)

            if ($enableCopyPrerequisites -eq "true")
            {
                Write-Verbose "Enabling winrm for virtual machine $resourceName" -Verbose
                Add-AzureVMCustomScriptExtension -resourceGroupName $resourceGroupName -vmId $resourceId -vmName $resourceName -dnsName $resourceFQDN `
                    -location $resource.Location -connectedServiceName $connectedServiceName -vstsAccessToken $vstsAccessToken
            }
        }

        return $azureRMVMsDetails
    }
}

function Check-AzureCloudServiceExists
{
    param([string]$cloudServiceName,
          [string]$connectionType)

    if(-not [string]::IsNullOrEmpty($cloudServiceName) -and -not [string]::IsNullOrEmpty($connectionType))
    {
        try
        {
            $azureCloudService = Get-AzureCloudService -cloudServiceName $cloudServiceName
        }
        catch [Hyak.Common.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "ExceptionMessage: $exceptionMessage" -Verbose

            # throwing only in case of Certificate authentication, Since userNamePassword authentication works with ARM resources also
            if($connectionType -eq 'Certificate')
            {
                Write-Telemetry "Input_Validation" "PREREQ_ResourceGroupNotFound"
                throw (Get-VstsLocString -Key "AFC_ResourceGroupNotFoundForSelectedConnection" -ArgumentList $connectionType, $cloudServiceName)
            }
        }
    }
}

function Get-AzureVMResourcesProperties
{
    param([string]$resourceGroupName,
          [string]$connectionType,
          [string]$resourceFilteringMethod,
          [string]$machineNames,
          [string]$enableCopyPrerequisites,
          [string]$connectedServiceName,
          [string]$vstsAccessToken)

    $machineNames = $machineNames.Trim()
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($connectionType))
    {
        if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
        {
            Check-AzureCloudServiceExists -cloudServiceName $resourceGroupName -connectionType $connectionType

            $azureClassicVMResources = Get-AzureClassicVMsInResourceGroup -resourceGroupName $resourceGroupName
            $filteredAzureClassicVMResources = Get-FilteredAzureClassicVMsInResourceGroup -azureClassicVMResources $azureClassicVMResources -resourceFilteringMethod $resourceFilteringMethod -filter $machineNames
            $azureVMsDetails = Get-AzureClassicVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureClassicVMResources $filteredAzureClassicVMResources

            # since authentication is userNamePassword, we will check whether resource group has RM resources
            if($connectionType -eq 'UserNamePassword' -and $azureVMsDetails.Count -eq 0)
            {
                Write-Verbose "Trying to find RM resources since there are no classic resources in resource group: $resourceGroupName"

                $azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName  $resourceGroupName
                $filteredAzureRMVMResources = Get-FilteredAzureRMVMsInResourceGroup -azureRMVMResources $azureRMVMResources -resourceFilteringMethod $resourceFilteringMethod -filter $machineNames
                $azureVMsDetails = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureRMVMResources $filteredAzureRMVMResources -enableCopyPrerequisites $enableCopyPrerequisites -connectedServiceName $connectedServiceName
            }
        }
        else
        {
            $azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName  $resourceGroupName
            $filteredAzureRMVMResources = Get-FilteredAzureRMVMsInResourceGroup -azureRMVMResources $azureRMVMResources -resourceFilteringMethod $resourceFilteringMethod -filter $machineNames
            $azureVMsDetails = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureRMVMResources $filteredAzureRMVMResources `
                -enableCopyPrerequisites $enableCopyPrerequisites -connectedServiceName $connectedServiceName -vstsAccessToken $vstsAccessToken
        }

        # throw if no azure VMs found in resource group or due to filtering
        if($azureVMsDetails.Count -eq 0)
        {
            if([string]::IsNullOrEmpty($machineNames) -or ($azureClassicVMResources.Count -eq 0 -and $azureRMVMResources.Count -eq 0))
            {
                if($connectionType -eq 'Certificate')
                {
                    Write-Telemetry "Input_Validation" "PREREQ_NoClassicVMResources"
                    throw (Get-VstsLocString -Key "AFC_NoClassicVMResources" -ArgumentList $resourceGroupName, $connectionType)
                }
                elseif($connectionType -eq 'ServicePrincipal')
                {
                    Write-Telemetry "Input_Validation" "PREREQ_NoRMVMResources"
                    throw (Get-VstsLocString -Key "AFC_NoARMVMResources" -ArgumentList $resourceGroupName, $connectionType)
                }
                else
                {
                     Write-Telemetry "Input_Validation" "PREREQ_NoVMResources"
                     throw (Get-VstsLocString -Key "AFC_NoGenericVMResources" -ArgumentList $resourceGroupName)
                }
            }
            else
            {
                Write-Telemetry "Input_Validation" "FILTERING_NoVMResources"
                throw (Get-VstsLocString -Key "AFC_FilteringNoVMResources" -ArgumentList $resourceGroupName, $resourceFilteringMethod, $machineNames)
            }
        }

        return $azureVMsDetails
    }
}

function Get-AzureVMsCredentials
{
    param([string][Parameter(Mandatory=$true)]$vmsAdminUserName,
          [string][Parameter(Mandatory=$true)]$vmsAdminPassword)

    Write-Verbose "Azure VMs Admin Username: $vmsAdminUserName"
    $azureVmsCredentials = New-Object 'System.Net.NetworkCredential' -ArgumentList $vmsAdminUserName, $vmsAdminPassword

    return $azureVmsCredentials
}

function Copy-FilesParallellyToAzureVMs
{
    param(
        [string[]]$targetMachineNames,
        [pscredential]$credential,
        [string]$protocol,
        [object]$remoteScriptJobArguments,
        [object]$sessionOption,
        [bool]$enableDetailedLogging
    )

    Write-Verbose "Starting parallel file copy"

    try
    {
        $parallelCopyJobResults = Invoke-RemoteScript -targetMachineNames $targetMachineNames `
                                                      -credential $credential `
                                                      -protocol $protocol `
                                                      -remoteScriptJobArguments $remoteScriptJobArguments `
                                                      -sessionOption $sessionOption `
                                                      -uploadLogFiles:$enableDetailedLogging

        Write-Verbose "Parallel file copy: Invoke-RemoteScript completed"
    }
    catch
    {
        Write-Verbose "Parallel file copy: Invoke-RemoteScript threw exception"
        throw
    }

    # Write job status for every VM
    $isFileCopyFailed = $false
    $parallelCopyJobResults | ForEach-Object {
        if($_.ExitCode -eq 0)
        {
            Write-Verbose "Copy source files status for $($_.ComputerName): Successful"
        }
        else
        {
            $isFileCopyFailed = $true
            Write-Verbose "Copy source files status for $($_.ComputerName): Failed"
        }
    }

    # Throw if any of the remote jobs failed
    if($isFileCopyFailed)
    {
        ThrowError -errorMessage (Get-VstsLocString -Key "AFC_ParallelCopyFailed")
    }

    Write-Verbose "Successfully finished parallel file copy"
}

function Copy-FilesSequentiallyToAzureVMs
{
    param(
        [string[]]$targetMachineNames,
        [pscredential]$credential,
        [string]$protocol,
        [object]$remoteScriptJobArguments,
        [object]$sessionOption,
        [bool]$enableDetailedLogging
    )

    Write-Verbose "Starting sequential file copy"

    $targetMachineNames | ForEach-Object {
        Write-Output (Get-VstsLocString -Key "AFC_CopyStarted" -ArgumentList $_)
        $targetMachineName = @($_)

        try
        {
            $copyJobResult = Invoke-RemoteScript -targetMachineNames $targetMachineName `
                                                 -credential $credential `
                                                 -protocol $protocol `
                                                 -remoteScriptJobArguments $remoteScriptJobArguments `
                                                 -sessionOption $sessionOption `
                                                 -uploadLogFiles:$enableDetailedLogging

             Write-Verbose "Sequential file copy: Invoke-RemoteScript completed"
        }
        catch
        {
            Write-Verbose "Sequential file copy: Invoke-RemoteScript threw exception"
            throw
        }

        if($copyJobResult.ExitCode -eq 0)
        {
            Write-Verbose "Copy source files status for $_ : Successful"
        }
        else
        {
            Write-Verbose "Copy source files status for $_ : Failed"
            ThrowError -errorMessage (Get-VstsLocString -Key "AFC_CopyFailed" -ArgumentList $_)
        }
    }

    Write-Verbose "Successfully finished sequential file copy"
}

function Copy-FilesToAzureVMsFromStorageContainer
{
    param(
        [string[]]$targetMachineNames,
        [pscredential]$credential,
        [string]$protocol,
        [object]$sessionOption,
        [string]$blobStorageEndpoint,
        [string]$containerName,
        [string]$containerSasToken,
        [string]$targetPath,
        [bool]$cleanTargetBeforeCopy,
        [bool]$copyFilesInParallel,
        [string]$additionalArguments,
        [string]$azCopyToolLocation,
        [scriptblock]$fileCopyJobScript,
        [bool]$enableDetailedLogging
    )

    # Generate storage container URL
    $containerURL = [string]::Format("{0}/{1}", $blobStorageEndpoint.Trim("/"), $containerName)

    $azCopyToolFileNames = Get-ChildItem $azCopyToolLocation | Select-Object -ExpandProperty Name
    $azCopyToolFilePaths = Get-ChildItem $azCopyToolLocation | Select-Object -ExpandProperty FullName

    $azCopyToolFileContents = @()
    
    foreach ($file in $azCopyToolFilePaths)
    {
        $azCopyToolFileContents += [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file))
    }

    $azCopyToolFileNamesString = $azCopyToolFileNames -join ";"
    $azCopyToolFileContentsString = $azCopyToolFileContents -join ";"

    # script block arguments
    $scriptBlockArgs = " -containerURL '$containerURL' -targetPath '$targetPath' -containerSasToken '$containerSasToken' -additionalArguments '$additionalArguments' -azCopyToolFileNamesString '$azCopyToolFileNamesString' -azCopyToolFileContentsString '$azCopyToolFileContentsString'"
    if($cleanTargetBeforeCopy)
    {
        $scriptBlockArgs += " -CleanTargetBeforeCopy"
    }
    if($enableDetailedLogging)
    {
        $scriptBlockArgs += " -EnableDetailedLogging"
    }

    $remoteScriptJobArguments = @{
        inline = $true;
        inlineScript = $fileCopyJobScript.ToString();
        scriptArguments = $scriptBlockArgs;
        errorActionPreference = "Stop";
        failOnStdErr = $true;
    }

    if($copyFilesInParallel)
    {
        Copy-FilesParallellyToAzureVMs -targetMachineNames $targetMachineNames `
                                       -credential $credential `
                                       -protocol $protocol `
                                       -remoteScriptJobArguments $remoteScriptJobArguments `
                                       -sessionOption $sessionOption `
                                       -enableDetailedLogging $enableDetailedLogging
    }
    else
    {
        Copy-FilesSequentiallyToAzureVMs -targetMachineNames $targetMachineNames `
                                         -credential $credential `
                                         -protocol $protocol `
                                         -remoteScriptJobArguments $remoteScriptJobArguments `
                                         -sessionOption $sessionOption `
                                         -enableDetailedLogging $enableDetailedLogging
    }
}

function Validate-CustomScriptExecutionStatus
{
    param([string]$resourceGroupName,
        [string]$vmName,
        [string]$extensionName,
        [object]$endpoint,
        [string]$connectedServiceNameARM,
        [string]$vstsAccessToken)

    Write-Verbose "Validating the winrm configuration custom script extension status"

    $isScriptExecutionPassed = $true
    try
    {
        $status = Get-AzureMachineStatus -resourceGroupName $resourceGroupName -Name $vmName

        # For AzurePS < 1.0.4 $_.ExtensionType is applicable.
        $customScriptExtension = $status.Extensions | Where-Object { ($_.ExtensionType -eq "Microsoft.Compute.CustomScriptExtension" -or $_.Type -eq "Microsoft.Compute.CustomScriptExtension") -and $_.Name -eq $extensionName }

        if($customScriptExtension)
        {
            $subStatuses = $customScriptExtension.SubStatuses
            $subStatusesStr = $subStatuses | Out-String

            Write-Verbose "Custom script extension execution statuses: $subStatusesStr"

            if($subStatuses)
            {
                foreach($subStatus in $subStatuses)
                {
                    if($subStatus.Code.Contains("ComponentStatus/StdErr") -and (-not [string]::IsNullOrEmpty($subStatus.Message)))
                    {
                        $isScriptExecutionPassed = $false
                        $errMessage = $subStatus.Message
                        break
                    }
                }
            }
            else
            {
                $isScriptExecutionPassed = $false
                $errMessage = "No execution status exists for the custom script extension '$extensionName'"
            }
        }
        else
        {
            $isScriptExecutionPassed = $false
            $errMessage = "No custom script extension '$extensionName' exists"
        }
    }
    catch
    {
        $isScriptExecutionPassed = $false
        $errMessage = $_.Exception.Message
    }

    if(-not $isScriptExecutionPassed)
    {
        $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName `
            -endpoint $endpoint -connectedServiceNameARM $connectedServiceNameARM -vstsAccessToken $vstsAccessToken
        throw (Get-VstsLocString -Key "AFC_SetCustomScriptExtensionFailed" -ArgumentList $extensionName, $vmName, $errMessage)
    }

    Write-Verbose "Validated the script execution successfully"
}

function Is-WinRMCustomScriptExtensionExists
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$extensionName,
          [string]$connectedServiceName,
          [string]$vstsAccessToken)

    $isExtensionExists = $true
    $removeExtension = $false

    try
    {
        $serviceEndpoint=Get-Endpoint $connectedServiceName
        $customScriptExtension = Get-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName `
            -endpoint $serviceEndpoint -connectedServiceNameARM $connectedServiceName -vstsAccessToken $vstsAccessToken

        if($customScriptExtension)
        {
            if($customScriptExtension.ProvisioningState -ne "Succeeded")
            {
                $removeExtension = $true
            }
            else
            {
                try
                {
                    Validate-CustomScriptExecutionStatus -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName -endpoint $serviceEndpoint
                }
                catch
                {
                    $isExtensionExists = $false
                }
            }
        }
        else
        {
            $isExtensionExists = $false
        }
    }
    catch
    {
        $isExtensionExists = $false
    }

    if($removeExtension)
    {
        $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName `
            -endpoint $serviceEndpoint -connectedServiceNameARM $connectedServiceName -vstsAccessToken $vstsAccessToken

        try
        {
            $index = 1
            $maxCount = 45   # Setting timeout for deleting extension as 15 mins.

            while($index -le $maxCount) {
                Write-Verbose "Checking WinRM custom script extension status $index times"

                $customScriptExtension = Get-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName `
                    -endpoint $serviceEndpoint -connectedServiceNameARM $connectedServiceName -vstsAccessToken $vstsAccessToken

                if(-not $customScriptExtension -or $customScriptExtension.ProvisioningState -ne "deleting")
                {
                    break
                }

                start-sleep -s 20
                $index = $index + 1
            }
        }
        catch
        {
            Write-Verbose ("Failed to get extension with error : " + $_.exception.message)
        }

        if ($index -gt $maxCount)
        {
            Write-Warning (Get-VstsLocString -Key AFC_UninstallWinRMCustomScriptExtension)
        }

        $isExtensionExists = $false
    }

    $isExtensionExists
}

function Get-TargetUriFromFwdLink { 
    param(
        [string]$fwdLink
    )   
    Write-Verbose "Trying to get the target uri from the fwdLink: $fwdLink"
    $proxy = Get-VstsWebProxy
    Add-Type -AssemblyName System.Net.Http
    $validHttpRedirectCodes = @(
        [System.Net.HttpStatusCode]::Moved,
        [System.Net.HttpStatusCode]::MovedPermanently,
        [System.Net.HttpStatusCode]::Found,
        [System.Net.HttpStatusCode]::Redirect,
        [System.Net.HttpStatusCode]::RedirectKeepVerb,
        [System.Net.HttpStatusCode]::TemporaryRedirect
    )
    $HttpClientHandler = New-Object System.Net.Http.HttpClientHandler
    $HttpClientHandler.Proxy = $proxy
    $HttpClientHandler.AllowAutoRedirect = $false
    $HttpClient = New-Object System.Net.Http.HttpClient -ArgumentList $HttpClientHandler
    $response = $HttpClient.GetAsync($fwdLink)
    $response.Wait()
    if($validHttpRedirectCodes.IndexOf($response.Result.StatusCode) -eq -1) {
        Write-Verbose "The http response code: $([int]$response.Result.StatusCode) is not a valid redirect response code."
        throw (Get-VstsLocString -Key "AFC_RedirectResponseInvalidStatusCode" -ArgumentList $([int]$response.Result.StatusCode))
    }
    $targetUri =  $response.Result.Headers.Location.AbsoluteUri
    if([string]::IsNullOrEmpty($targetUri)) {
        Write-Verbose "The target uri is null"
        throw (Get-VstsLocString -Key "AFC_RedirectResponseLocationHeaderIsNull")
    }
    Write-Verbose "The target uri is: $targetUri"
    return $targetUri
}

function Add-WinRMHttpsNetworkSecurityRuleConfig
{
    param([string]$resourceGroupName,
          [string]$vmId,
          [string]$ruleName,
          [string]$rulePriotity,
          [string]$winrmHttpsPort)
    
    Write-Verbose "Trying to add a network security group rule"

    try
    {
        $securityGroups = Get-NetworkSecurityGroups -resourceGroupName $resourceGroupName -vmId $vmId

        if($securityGroups.Count -gt 0)
        {
            Add-NetworkSecurityRuleConfig -resourceGroupName $resourceGroupName -securityGroups $securityGroups -ruleName $ruleName -rulePriotity $rulePriotity -winrmHttpsPort $winrmHttpsPort
        }
    }
    catch
    {
        Write-Telemetry "Task_InternalError" "NetworkSecurityRuleConfigFailed"
        Write-Warning (Get-VstsLocString -Key "AFC_AddNetworkSecurityRuleFailed" -ArgumentList $_.exception.message)
    }
}

function Add-AzureVMCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmId,
          [string]$vmName,
          [string]$dnsName,
          [string]$location,
          [string]$connectedServiceName,
          [string]$vstsAccessToken)

    $configWinRMScriptFileFwdLink ="https://aka.ms/vstsconfigurewinrm"
    $makeCertFileFwdLink ="https://aka.ms/vstsmakecertexe"
    $scriptToRun="ConfigureWinRM.ps1"
    $extensionName="WinRMCustomScriptExtension"
    $ruleName = "VSO-Custom-WinRM-Https-Port"
    $rulePriotity="3986"
    $winrmHttpsPort = "5986"

    Write-Verbose "Adding custom script extension '$extensionName' for virtual machine '$vmName'"
    Write-Verbose "VM Location : $location"
    Write-Verbose "VM DNS : $dnsName"

    try
    {
        $endpoint = Get-Endpoint $connectedServiceName
        $isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName `
            -connectedServiceName $connectedServiceName -vstsAccessToken $vstsAccessToken
        Write-Verbose -Verbose "IsExtensionExists: $isExtensionExists"

        if($isExtensionExists)
        {
            Add-WinRMHttpsNetworkSecurityRuleConfig -resourceGroupName $resourceGroupName -vmId $vmId -ruleName $ruleName -rulePriotity $rulePriotity -winrmHttpsPort $winrmHttpsPort

            Write-Verbose "Skipping the addition of custom script extension '$extensionName' as it already exists"
            return
        }

        $configWinRMScriptFile = Get-TargetUriFromFwdLink -fwdLink $configWinRMScriptFileFwdLink
        $makeCertFile = Get-TargetUriFromFwdLink -fwdLink $makeCertFileFwdLink

        $result = Set-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -fileUri $configWinRMScriptFile, $makeCertFile  -run $scriptToRun -argument $dnsName -location $location
        $resultDetails = $result | ConvertTo-Json
        Write-Verbose "Set-AzureMachineCustomScriptExtension completed with response : $resultDetails"

        if($result.Status -ne "Succeeded")
        {
            Write-Telemetry "Task_InternalError" "ProvisionVmCustomScriptFailed"

            $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName `
                -endpoint $endpoint -connectedServiceNameARM $connectedServiceName -vstsAccessToken $vstsAccessToken
            throw (Get-VstsLocString -Key "AFC_UnableToSetCustomScriptExtension" -ArgumentList $extensionName, $vmName, $result.Error.Message)
        }

        Validate-CustomScriptExecutionStatus -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName -endpoint $endpoint
        Add-WinRMHttpsNetworkSecurityRuleConfig -resourceGroupName $resourceGroupName -vmId $vmId -ruleName $ruleName -rulePriotity $rulePriotity -winrmHttpsPort $winrmHttpsPort
    }
    catch
    {
         Write-Telemetry "Task_InternalError" "ExecutionOfVmCustomScriptFailed:$exceptionType"    
         throw (Get-VstsLocString -Key "AFC_CopyPrereqsFailed" -ArgumentList $_.exception.message)
    }

    Write-Verbose "Successfully added the custom script extension '$extensionName' for virtual machine '$vmName'"
}

function Check-ContainerNameAndArgs
{
    param([string]$containerName,
          [string]$additionalArguments)
    
    $additionalArguments = ' ' + $additionalArguments + ' '
    if($containerName -eq '$root' -and $additionalArguments -like '* /S *')
    {
        Write-Warning (Get-vstsLocString -Key "AFC_RootContainerAndDirectory")
    }
}

function Get-InvokeRemoteScriptParameters
{
    param([object][Parameter(Mandatory=$true)]$azureVMResourcesProperties,
          [object]$networkCredentials,
          [bool]$skipCACheck)

    $sessionOption = New-PSSessionOption -SkipCACheck:$skipCACheck

    $psCredentials = New-Object PSCredential($networkCredentials.UserName, (ConvertTo-SecureString $networkCredentials.Password -AsPlainText -Force))

    $targetMachines = @()
    foreach($vm in $azureVMResourcesProperties.Values)
    {
        $targetMachines += [string]::Format("{0}:{1}", $vm.fqdn, $vm.winRMHttpsPort)
    }

    $protocol = 'https'

    return @{
        targetMachineNames = $targetMachines;
        credential = $psCredentials;
        protocol = $protocol;
        sessionOption = $sessionOption
    }
}

function Validate-AdditionalArguments([string]$additionalArguments)
{
    if($additionalArguments -match "[&;|]")
    {
        ThrowError -errorMessage (Get-VstsLocString -Key "AFC_AdditionalArgumentsMustNotIncludeForbiddenCharacters")
    }
}