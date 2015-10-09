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
Write-Verbose "vmsUsername = $vmsUsername" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose
Write-Verbose "skipCACheck = $skipCACheck" -Verbose

# Constants #
$defaultSasTokenTimeOutInHours = 2
$useHttpsProtocolOption = ''
$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''
$azureFileCopyOperation = 'AzureFileCopy'
$ErrorActionPreference = 'Stop'
$ARMStorageAccountResourceType =  "Microsoft.Storage/storageAccounts"

# Load all dependent files for execution
. ./AzureFileCopyJob.ps1

# Import all the dlls and modules which have cmdlets we need
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

# Start region Azure Calls(ARM/RDFE) Functions
function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    try
    {
        Write-Verbose "[Azure Call]Getting resource details for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose
        $azureStorageAccountResourceDetails = Get-AzureResource -ResourceName $storageAccountName | Where-Object { $_.ResourceType -eq $ARMStorageAccountResourceType }
        Write-Verbose "[Azure Call]Retrieved resource details successfully for azure storage account resource: $storageAccountName with resource type: $ARMStorageAccountResourceType" -Verbose

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

    Write-Verbose "[Azure Call]Retrieving storage key for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose
    $storageKeyDetails = Get-AzureStorageAccountKey -ResourceGroupName $azureResourceGroupName -Name $storageAccount 
    $storageKey = $storageKeyDetails.Key1
    Write-Verbose "[Azure Call]Retrieved storage key successfully for the storage account: $storageAccount in resource group: $azureResourceGroupName" -Verbose

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

function Remove-AzureContainer
{
    param([string]$containerName,
          [Microsoft.WindowsAzure.Commands.Common.Storage.AzureStorageContext]$storageContext,
          [string]$storageAccount)

    Write-Verbose "[Azure Call]Deleting container: $containerName in storage account: $storageAccount" -Verbose
    Remove-AzureStorageContainer -Name $containerName -Context $storageContext -Force -ErrorAction SilentlyContinue
    Write-Verbose "[Azure Call]Deleted container: $containerName in storage account: $storageAccount" -Verbose
}

function Get-AzureVMsInResourceGroup
{
    param([string]$resourceGroupName)

    try
    {
        Write-Verbose -Verbose "[Azure Call]Getting resource group:$resourceGroupName virtual machines type resources"
        $azureVMResources = Get-AzureVM -ResourceGroupName $resourceGroupName -Verbose
        Write-Verbose -Verbose "[Azure Call]Got resource group:$resourceGroupName virtual machines type resources"
        Set-Variable -Name azureVMResources -Value $azureVMResources -Scope "Global"
    }
    catch [Microsoft.WindowsAzure.Commands.Common.ComputeCloudException]
    {
        Write-Error $_.Exception.InnerException.Message -Verbose
    }
    catch
    {
        Write-Error $_.Exception.Message -Verbose
    }
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVMResources)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource group: $resourceGroupName" -Verbose

        Write-Verbose "[Azure Call]Getting LoadBalancer Frontend Ip Config" -Verbose
        $frontEndIPConfigs = Get-AzureLoadBalancerFrontendIpConfig -LoadBalancer $loadBalancer
        Write-Verbose "[Azure Call]Got LoadBalancer Frontend Ip Config" -Verbose

        #Map the public ip id to the fqdn
        foreach($publicIp in $publicIPAddressResources)
        {
            if([string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn) -eq $false)
            {
                $fqdnMap[$publicIp.Id] =  $publicIP.DnsSettings.Fqdn
            }
            else
            {
                $fqdnMap[$publicIp.Id] =  $publicIP.IpAddress
            }
        }

        #Get the NAT rule for a given ip id
        foreach($config in $frontEndIPConfigs)
        {
            $fqdn = $fqdnMap[$config.PublicIpAddress.Id]
            if([string]::IsNullOrEmpty($fqdn) -eq $false)
            {
                $fqdnMap.Remove($config.PublicIpAddress.Id)
                foreach($rule in $config.InboundNatRules)
                {
                    $fqdnMap[$rule.Id] =  $fqdn
                }
            }
        }

        #Find out the NIC, and thus the corresponding machine to which the HAT rule belongs
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                foreach($rule in $ipc.LoadBalancerInboundNatRules)
                {
                    $fqdn = $fqdnMap[$rule.Id]
                    if([string]::IsNullOrEmpty($fqdn) -eq $false)
                    {
                        $fqdnMap.Remove($rule.Id)
                        if($nic.VirtualMachine)
                        {
                            $fqdnMap[$nic.VirtualMachine.Id] = $fqdn
                        }
                    }
                }
            }
        }
    }

    Write-Verbose "Got FQDN for the resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function GetMachineNameFromId
{
    param([string]$resourceGroupName,
          [System.Collections.Hashtable]$map,
          [string]$mapParameter,
          [boolean]$throwOnTotalUnavaialbility)
    
    if($map)
    {
        $errorCount = 0
        foreach($vm in $azureVMResources)
        {
            $value = $map[$vm.Id]
            $resourceName = $vm.Name
			
            if([string]::IsNullOrEmpty($value) -eq $false)
            {
                Write-Verbose "$mapParameter value for resource $resourceName is $value" -Verbose
                $map.Remove($vm.Id)
                $map[$resourceName] = $value
            }
            else
            {
                $errorCount = $errorCount + 1
                Write-Verbose "Unable to find $mapParameter for resource $resourceName" -Verbose
            }
        }
        
        if($throwOnTotalUnavaialbility -eq $true)
        {
            if($errorCount -eq $azureVMResources.Count -and $azureVMResources.Count -ne 0)
            {
                throw (Get-LocalizedString -Key "Unable to get {0} for all resources in ResourceGroup : '{1}'" -ArgumentList $mapParameter, $resourceGroupName)
            }
            else
            {
                if($errorCount -gt 0 -and $errorCount -ne $azureVMResources.Count)
                {
                    Write-Warning (Get-LocalizedString -Key "Unable to get {0} for '{1}' resources in ResourceGroup : '{2}'" -ArgumentList $mapParameter, $errorCount, $resourceGroupName)
                }
            }
        }

        return $map
    }
}

function Get-MachinesFqdns
{
    param([string]$resourceGroupName)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $azureVMResources)
    {
        Write-Verbose "Trying to get FQDN for the resources from resource Group $resourceGroupName" -Verbose

        #Map the ipc to the fqdn
        foreach($publicIp in $publicIPAddressResources)
        {
            if([string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn) -eq $false)
            {			    
                $fqdnMap[$publicIp.IpConfiguration.Id] =  $publicIP.DnsSettings.Fqdn
            }
            else
            {
                $fqdnMap[$publicIp.IpConfiguration.Id] =  $publicIP.IpAddress
            }
        }

        #Find out the NIC, and thus the VM corresponding to a given ipc
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipc in $nic.IpConfigurations)
            {
                $fqdn =  $fqdnMap[$ipc.Id]
                if([string]::IsNullOrEmpty($fqdn) -eq $false)
                {
                    $fqdnMap.Remove($ipc.Id)
                    if($nic.VirtualMachine)
                    {
                        $fqdnMap[$nic.VirtualMachine.Id] = $fqdn
                    }
                }
            }
        }

        $fqdnMap = GetMachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
    }

    Write-Verbose "Got FQDN for the resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-FrontEndPorts
{
    param([string]$backEndPort,
          [System.Collections.Hashtable]$portList)

    if([string]::IsNullOrEmpty($backEndPort) -eq $false -and $networkInterfaceResources -and $loadBalancer -and $azureVMResources)
    {
        Write-Verbose "Trying to get front end ports for $backEndPort" -Verbose

        Write-Verbose "[Azure Call]Getting Azure LoadBalancer Inbound NatRule Config" -Verbose
        $rules = Get-AzureLoadBalancerInboundNatRuleConfig -LoadBalancer $loadBalancer
        Write-Verbose "[Azure Call]Got Azure LoadBalancer Inbound NatRule Config" -Verbose

        $filteredRules = $rules | Where-Object {$_.BackendPort -eq $backEndPort}

        #Map front end port to back end ipc
        foreach($rule in $filteredRules)
        {
            if($rule.BackendIPConfiguration)
            {
                $portList[$rule.BackendIPConfiguration.Id] = $rule.FrontendPort
            }
        }

        #Get the nic, and the corresponding machine id for a given back end ipc
        foreach($nic in $networkInterfaceResources)
        {
            foreach($ipConfig in $nic.IpConfigurations)
            {
                $frontEndPort = $portList[$ipConfig.Id]
                if([string]::IsNullOrEmpty($frontEndPort) -eq $false)
                {
                    $portList.Remove($ipConfig.Id)
                    if($nic.VirtualMachine)
                    {
                        $portList[$nic.VirtualMachine.Id] = $frontEndPort
                    }
                }
            }
        }
    }
    
    Write-Verbose "Got front end ports for $backEndPort" -Verbose

    return $portList
}

function Get-MachineConnectionInformation
{
    param([string]$resourceGroupName)
    
    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose -Verbose "[Azure Call]Getting network interfaces in resource group $resourceGroupName"
        $networkInterfaceResources = Get-AzureNetworkInterface -ResourceGroupName $resourceGroupName -Verbose
        Write-Verbose -Verbose "[Azure Call]Got network interfaces in resource group $resourceGroupName"
        Set-Variable -Name networkInterfaceResources -Value $networkInterfaceResources -Scope "Global"

        Write-Verbose -Verbose "[Azure Call]Getting public IP Addresses in resource group $resourceGroupName"
        $publicIPAddressResources = Get-AzurePublicIpAddress -ResourceGroupName $resourceGroupName -Verbose
        Write-Verbose -Verbose "[Azure Call]Got public IP Addresses in resource group $resourceGroupName"
        Set-Variable -Name publicIPAddressResources -Value $publicIPAddressResources -Scope "Global"

        Write-Verbose -Verbose "[Azure Call]Getting load balancers in resource group $resourceGroupName"
        $lbGroup = Get-AzureResource -ResourceGroupName $resourceGroupName -ResourceType "Microsoft.Network/loadBalancers" -Verbose
        Write-Verbose -Verbose "[Azure Call]Got load balancers in resource group $resourceGroupName"

        $fqdnMap = @{}
        Set-Variable -Name fqdnMap -Value $fqdnMap -Scope "Global"

        $winRmHttpsPortMap = @{}
        Set-Variable -Name winRmHttpsPortMap -Value $winRmHttpsPortMap -Scope "Global"

        if($lbGroup)
        {
            foreach($lb in $lbGroup)
            {
                Write-Verbose -Verbose "[Azure Call]Getting load balancer in resource group $resourceGroupName"
                $loadBalancer = Get-AzureLoadBalancer -Name $lb.Name -ResourceGroupName $resourceGroupName -Verbose
                Write-Verbose -Verbose "[Azure Call]Got load balancer in resource group $resourceGroupName"
                Set-Variable -Name loadBalancer -Value $loadBalancer -Scope "Global"

                $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName
                $winRmHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRmHttpsPortMap
            }

            $fqdnMap = GetMachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -ThrowOnTotalUnavaialbility $true
            $winRmHttpsPortMap = GetMachineNameFromId -Map $winRmHttpsPortMap -MapParameter "Front End port" -ThrowOnTotalUnavaialbility $false
        }
        else
        {
            $fqdnMap = Get-MachinesFqdns -resourceGroupName $resourceGroupName
            $winRmHttpsPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
        }
    }
}

# End region Azure Calls(ARM/RDFE) Functions

# Start region Utilities Functions

function ThrowError
{
    param([string]$errorMessage)

    $readmelink = "http://aka.ms/azurefilecopyreadme"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
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

function Get-AzureVMResourcesProperties
{
    param([object]$resources)

    [hashtable]$resourcesPropertyBag = @{}
    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        $resourceFQDN = $fqdnMap[$resourceName]
        $resourceWinRmHttpsPort = $winRmHttpsPortMap[$resourceName]

        $resourceProperties = @{}
        $resourceProperties.Name = $resourceName
        $resourceProperties.fqdn = $resourceFQDN
        $resourceProperties.winRMHttpsPort = $resourceWinRmHttpsPort

        $resourcesPropertyBag.Add($resourceName, $resourceProperties)
    }

    return $resourcesPropertyBag
}

function Get-AzureVMsCredentials
{
    Write-Verbose "Azure VMs Admin Username: $vmsAdminUserName" -Verbose

    $azureVmsCredentials = New-Object 'System.Net.NetworkCredential' -ArgumentList $vmsAdminUserName, $vmsAdminPassword

    return $azureVmsCredentials
}

function Get-SkipCACheckOption
{
    if ($skipCACheck -eq "false")
    {
        Write-Verbose "Not skipping CA Check" -Verbose
        return $doNotSkipCACheckOption
    }

    Write-Verbose "Skipping CA Check" -Verbose
    return $doSkipCACheckOption
}

# End region Utilities Functions

# TASK MAIN EXECUTION BEGINS #
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
$storageAccount = $storageAccount.Trim()
try
{
    Switch-AzureMode AzureServiceManagement

    # getting storage key from RDFE    
    $storageKey = Get-AzureStorageKeyFromRDFE -storageAccountName $storageAccount
}
catch [Hyak.Common.CloudException]
{
    $errorMsg = $_.Exception.Message.ToString()
    Write-Verbose "[Azure Call](RDFE) $errorMsg" -Verbose

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
    Get-AzureVMsInResourceGroup -resourceGroupName $environmentName
    if ($azureVMResources.Count -eq 0)
    {
        throw (Get-LocalizedString -Key "No machine exists under resource group: '{0}' for copy" -ArgumentList $environmentName)
    }

    Get-MachineConnectionInformation -resourceGroupName $environmentName

    $skipCACheckOption = Get-SkipCACheckOption
    $azureVmsCredentials = Get-AzureVMsCredentials

    $azureVMResourcesPropertiesBag = Get-AzureVMResourcesProperties -resources $azureVMResources

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
            $resourceWinRmHttpsPort = $resourceProperties.winRMHttpsPort

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $resourceName)

            $copyResponse = Invoke-Command -ScriptBlock $AzureFileCopyJob -ArgumentList $resourceFQDN, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $azureVmsCredentials, $cleanTargetBeforeCopy, $resourceWinRmHttpsPort, $useHttpsProtocolOption, $skipCACheckOption, $enableDetailedLoggingString
            $status = $copyResponse.Status

            Write-ResponseLogs -operationName $azureFileCopyOperation -fqdn $resourceName -deploymentResponse $copyResponse
            Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $resourceName, $status)

            if ($status -ne "Passed")
            {
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
        foreach ($resource in $azureVMResources)
        {
            $resourceProperties = $azureVMResourcesPropertiesBag.Item($resource.Name)
            $resourceFQDN = $resourceProperties.fqdn
            $resourceName = $resourceProperties.Name
            $resourceWinRmHttpsPort = $resourceProperties.winRMHttpsPort

            Write-Output (Get-LocalizedString -Key "Copy started for machine: '{0}'" -ArgumentList $resourceName)

            $job = Start-Job -ScriptBlock $AzureFileCopyJob -ArgumentList $resourceFQDN, $storageAccount, $containerName, $containerSasToken, $azCopyLocation, $targetPath, $azureVmsCredentials, $cleanTargetBeforeCopy, $resourceWinRmHttpsPort, $useHttpsProtocolOption, $skipCACheckOption, $enableDetailedLoggingString
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
    throw
}
finally
{
    Remove-AzureContainer -containerName $containerName -storageContext $storageContext -storageAccount $storageAccount
    Write-Verbose "Completed Azure File Copy Task for Azure VMs Destination" -Verbose
}