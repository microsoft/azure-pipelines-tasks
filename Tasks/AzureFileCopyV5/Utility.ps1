# Utility Functions used by AzureFileCopy.ps1 (other than azure calls) #

$ErrorActionPreference = 'Stop'
$azureStackEnvironment = "AzureStack"
$jobId = $env:SYSTEM_JOBID;

function Get-AzureCmdletsVersion
{
    return (Get-Module AzureRM -ListAvailable).Version
}

function Get-AzureVersionComparison($azureVersion, $compareVersion)
{
    Write-Verbose "Compare azure versions: $azureVersion, $compareVersion"
    return ($azureVersion -and $azureVersion -gt $compareVersion)
}

function Get-AzureUtility
{
	$azureUtilityARM = "AzureUtilityARM.ps1"
    $azUtilityVersion100 = "AzureUtilityAz1.0.ps1"

    if (Get-Module Az.Accounts -ListAvailable){
        Write-Verbose "Az module is installed in the agent."
        return $azUtilityVersion100
    }
	
    return $azureUtilityARM
}

function Get-Endpoint
{
    param([String] [Parameter(Mandatory=$true)] $connectedServiceName)

    $serviceEndpoint = Get-VstsEndpoint -Name "$connectedServiceName"
    return $serviceEndpoint
}

function Validate-AzurePowershellVersion
{
    Write-Verbose "Validating installed azure powershell version is greater than or equal to AzureRM 1.1.0"
    if (!(Get-Module Az.Accounts -ListAvailable)){
        $currentVersion =  Get-AzureCmdletsVersion
        Write-Verbose "Installed Azure PowerShell version: $currentVersion"

        $minimumAzureVersion = New-Object System.Version(1, 1, 0)
        $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

        if(!$versionCompatible)
        {
            Write-Telemetry "Task_InternalError" "UnsupportedAzurePSVersion"
            Throw (Get-VstsLocString -Key "AFC_AzurePSNotInstalled" -ArgumentList $minimumAzureVersion)
        }

        Write-Verbose "Validated the required azure powershell version is greater than or equal to 1.1.0"
    }
}

function Get-StorageKey
{
    param([string][Parameter(Mandatory=$true)]$storageAccountName,
          [object][Parameter(Mandatory=$true)]$endpoint)

    $storageAccountName = $storageAccountName.Trim()

    # checking azure powershell version to make calls to ARM endpoint
    Validate-AzurePowershellVersion

    # getting storage account key from ARM endpoint
    $storageKey = Get-AzureStorageKeyFromARM -storageAccountName $storageAccountName -serviceEndpoint $endpoint

    return $storageKey
}

function Get-blobStorageEndpoint
{
    param([string][Parameter(Mandatory=$true)]$storageAccountName,
          [object][Parameter(Mandatory=$true)]$endpoint)

    $storageAccountName = $storageAccountName.Trim()

    # getting storage account key from ARM endpoint
    $blobStorageEndpoint = Get-AzureBlobStorageEndpointFromARM -storageAccountName $storageAccountName -endpoint $endpoint

    return $blobStorageEndpoint
}

function Get-StorageAccountType
{
    param([string][Parameter(Mandatory=$true)]$storageAccountName,
          [object][Parameter(Mandatory=$true)]$endpoint)

    $storageAccountName = $storageAccountName.Trim()
    # getting storage account type from ARM endpoint
    $storageAccountType = Get-AzureStorageAccountTypeFromARM -storageAccountName $storageAccountName -endpoint $endpoint

	if($storageAccountType -ne $null)
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

function ConvertTo-Pfx {
    param(
        [String][Parameter(Mandatory = $true)] $pemFileContent
    )

    if ($ENV:Agent_TempDirectory) {
        $pemFilePath = "$ENV:Agent_TempDirectory\clientcertificate.pem"
        $pfxFilePath = "$ENV:Agent_TempDirectory\clientcertificate.pfx"
        $pfxPasswordFilePath = "$ENV:Agent_TempDirectory\clientcertificatepassword.txt"
    }
    else {
        $pemFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificate.pem"
        $pfxFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificate.pfx"
        $pfxPasswordFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificatepassword.txt"    
    }

    # save the PEM certificate to a PEM file
    Set-Content -Path $pemFilePath -Value $pemFileContent

    # use openssl to convert the PEM file to a PFX file
    $pfxFilePassword = [System.Guid]::NewGuid().ToString()

    if (CmdletHasMember -cmdlet Set-Content -memberName NoNewline) {
        Set-Content -Path $pfxPasswordFilePath -Value $pfxFilePassword -NoNewline
    }
    else {
        [System.IO.File]::WriteAllText($pfxPasswordFilePath, $pfxFilePassword, [System.Text.Encoding]::ASCII)
    }

    $openSSLExePath = "$PSScriptRoot\ps_modules\VstsAzureHelpers_\openssl\openssl.exe"
    $env:OPENSSL_CONF = "$PSScriptRoot\ps_modules\VstsAzureHelpers_\openssl\openssl.cnf"
    $env:RANDFILE=".rnd"
    
    $openSSLArgs = "pkcs12 -export -in $pemFilePath -out $pfxFilePath -password file:`"$pfxPasswordFilePath`""
     
    Invoke-VstsTool -FileName $openSSLExePath -Arguments $openSSLArgs -RequireExitCodeZero

    return $pfxFilePath, $pfxFilePassword
}

function Upload-FilesToAzureContainer
{
    param([string][Parameter(Mandatory=$true)]$sourcePath,
          [object][Parameter(Mandatory=$true)]$endPoint,
          [string][Parameter(Mandatory=$true)]$storageAccountName,
          [string][Parameter(Mandatory=$true)]$containerName,
          [string]$blobPrefix,
		  [string]$blobStorageEndpoint,
          [string][Parameter(Mandatory=$true)]$azCopyLocation,
          [string]$additionalArguments,
          [string][Parameter(Mandatory=$true)]$destinationType,
          [bool]$useDefaultArguments,
          [bool]$cleanTargetBeforeCopy
    )

    try
    {
        $aadAuthorityUrl = "https://login.microsoftonline.com/"
        if ($endpoint.Data.EnvironmentAuthorityUrl -ne $null) {
            $aadAuthorityUrl = $endpoint.Data.EnvironmentAuthorityUrl
        }

        Write-Verbose "AAD autority URL = $aadAuthorityUrl"
        Write-Host " mime: $PSScriptRoot\MimeMapping.json"
        $env:AZCOPY_CONTENT_TYPE_MAP ="$PSScriptRoot\MimeMapping.json"

        if ($endPoint.Auth.Scheme -eq 'ServicePrincipal') {
            try {
                if($endPoint.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
                    $pemFileContent = $endPoint.Auth.Parameters.ServicePrincipalCertificate
                    $pfxFilePath, $pfxFilePassword = ConvertTo-Pfx -pemFileContent $pemFileContent
                
                    $env:AZCOPY_SPA_CERT_PASSWORD = $pfxFilePassword
                    Write-Output "##[command] & `"$azCopyExeLocation`" login --service-principal --application-id `"$($endPoint.Auth.Parameters.ServicePrincipalId)`" --certificate-path `"$($pfxFilePath)`" --tenant-id=`"$($endPoint.Auth.Parameters.TenantId)`" --aad-endpoint `"$aadAuthorityUrl`""

                    $command = "& `"$azCopyExeLocation`" login --service-principal --application-id `"$($endPoint.Auth.Parameters.ServicePrincipalId)`" --certificate-path `"$($pfxFilePath)`" --tenant-id=`"$($endPoint.Auth.Parameters.TenantId)`" --aad-endpoint `"$aadAuthorityUrl`""
                    Invoke-Expression $command
                }
                else {
                    $env:AZCOPY_SPA_CLIENT_SECRET = $endPoint.Auth.Parameters.ServicePrincipalKey
                    Write-Output "##[command] & `"$azCopyExeLocation`" login --service-principal --application-id `"$($endPoint.Auth.Parameters.ServicePrincipalId)`" --tenant-id=`"$($endPoint.Auth.Parameters.TenantId)`" --aad-endpoint `"$aadAuthorityUrl`""

                    $command = "& `"$azCopyExeLocation`" login --service-principal --application-id `"$($endPoint.Auth.Parameters.ServicePrincipalId)`" --tenant-id=`"$($endPoint.Auth.Parameters.TenantId)`" --aad-endpoint `"$aadAuthorityUrl`""
                    Invoke-Expression $command
                }
            } 
            catch {
                # Provide an additional, custom, credentials-related error message.
                $exceptionMessage = $_.Exception.Message.ToString()
                Write-Verbose "ExceptionMessage: $exceptionMessage"
                throw (New-Object System.Exception((Get-VstsLocString -Key ServicePrincipalError), $_.Exception))
            }
        }
        elseif ($endPoint.Auth.Scheme -eq 'ManagedServiceIdentity') {
            Write-Output "##[command] & `"$azCopyExeLocation`" login --identity --aad-endpoint `"$aadAuthorityUrl`""

            $command = "& `"$azCopyExeLocation`" login --identity --aad-endpoint `"$aadAuthorityUrl`""
            Invoke-Expression $command

        }
        else {
            throw (Get-VstsLocString -Key UnsupportedAuthScheme -ArgumentList $endPoint.Auth.Scheme)
        } 
        
        Write-Output (Get-VstsLocString -Key "AFC_UploadFilesStorageAccount" -ArgumentList $sourcePath, $storageAccountName, $containerName, $blobPrefix)

        $blobPrefix = $blobPrefix.Trim()
        $containerURL = [string]::Format("{0}/{1}/{2}", $blobStorageEndpoint.Trim("/"), $containerName, $blobPrefix).Trim("/")
        $containerURL = $containerURL.Replace('$','`$')
        $azCopyExeLocation = Join-Path -Path $azCopyLocation -ChildPath "AzCopy.exe"
        if($cleanTargetBeforeCopy)
        {
           
             Write-Output "##[command] & `"$azCopyExeLocation`" rm `"$containerURL`" --recursive=true"

             $cleanToBlobCommand = "& `"$azCopyExeLocation`" rm `"$containerURL`" --recursive=true"

             Invoke-Expression $cleanToBlobCommand

        }

        Write-Output "##[command] & `"$azCopyExeLocation`" copy `"$sourcePath`" `"$containerURL`"  $additionalArguments"       

        $uploadToBlobCommand = "& `"$azCopyExeLocation`" copy `"$sourcePath`" `"$containerURL`" $additionalArguments"       

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
        #azcopy logout to remove all credentials
        Write-Output "##[command] & `"$azCopyExeLocation`" logout"
        $command = "& `"$azCopyExeLocation`" logout"
        Invoke-Expression $command
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
          [string]$connectedServiceName)

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
            $azureRGResourcesDetails = Get-AzureRMResourceGroupResourcesDetailsForAzureStack -resourceGroupName $resourceGroupName -azureRMVMResources $azureRMVMResources -endpoint $endpoint
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
                Add-AzureVMCustomScriptExtension -resourceGroupName $resourceGroupName -vmId $resourceId -vmName $resourceName -dnsName $resourceFQDN -location $resource.Location -connectedServiceName $connectedServiceName
            }
        }

        return $azureRMVMsDetails
    }
}

function Get-AzureVMResourcesProperties
{
    param([string]$resourceGroupName,
          [string]$resourceFilteringMethod,
          [string]$machineNames,
          [string]$enableCopyPrerequisites,
          [string]$connectedServiceName)

    $machineNames = $machineNames.Trim()
    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        $azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName  $resourceGroupName
        $filteredAzureRMVMResources = Get-FilteredAzureRMVMsInResourceGroup -azureRMVMResources $azureRMVMResources -resourceFilteringMethod $resourceFilteringMethod -filter $machineNames
        $azureVMsDetails = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureRMVMResources $filteredAzureRMVMResources -enableCopyPrerequisites $enableCopyPrerequisites -connectedServiceName $connectedServiceName

        # throw if no azure VMs found in resource group or due to filtering
        if($azureVMsDetails.Count -eq 0)
        {
            if([string]::IsNullOrEmpty($machineNames))
            {
                Write-Telemetry "Input_Validation" "PREREQ_NoRMVMResources"
                throw (Get-VstsLocString -Key "AFC_NoARMVMResources" -ArgumentList $resourceGroupName, $connectedServiceName)
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

    # script block arguments
    $scriptBlockArgs = " -containerURL '$containerURL' -targetPath '$targetPath' -containerSasToken '$containerSasToken' -additionalArguments '$additionalArguments'"
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
          [object]$endpoint)

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
        $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -endpoint $endpoint
        throw (Get-VstsLocString -Key "AFC_SetCustomScriptExtensionFailed" -ArgumentList $extensionName, $vmName, $errMessage)
    }

    Write-Verbose "Validated the script execution successfully"
}

function Is-WinRMCustomScriptExtensionExists
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$extensionName,
          [string]$connectedServiceName)

    $isExtensionExists = $true
    $removeExtension = $false

    try
    {
        $serviceEndpoint=Get-Endpoint $connectedServiceName
        $customScriptExtension = Get-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -endpoint $serviceEndpoint

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
        $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -endpoint $serviceEndpoint

        try
        {
            $index = 1 
            $maxCount = 45   # Setting timeout for deleting extension as 15 mins.

            while($index -le $maxCount) {
                Write-Verbose "Checking WinRM custom script extension status $index times"

                $customScriptExtension = Get-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -endpoint $serviceEndpoint

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
          [string]$connectedServiceName)

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
        $isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName -connectedServiceName $connectedServiceName
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

            $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -endpoint $endpoint
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
    if($containerName -eq '$root' -and $additionalArguments -like '* --recursive *')
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

function CleanUp-PSModulePathForHostedAgent {
    # Clean up PSModulePath for hosted agent
    $azureRMModulePath = "C:\Modules\azurerm_2.1.0"
    $azureModulePath = "C:\Modules\azure_2.1.0"
    $newEnvPSModulePath = $env:PSModulePath

    if ($newEnvPSModulePath.split(";") -contains $azureRMModulePath) {
        $newEnvPSModulePath = (($newEnvPSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
        write-verbose "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
    }
    else {
        write-verbose "$azureRMModulePath is not present in $newEnvPSModulePath"
    }

    if ($newEnvPSModulePath.split(";") -contains $azureModulePath) {
        $newEnvPSModulePath = (($newEnvPSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
        write-verbose "$azureModulePath removed. Restart the prompt for the changes to take effect."
    }
    else {
        write-verbose "$azureModulePath is not present in $newEnvPSModulePath"
    }

    if (Test-Path "C:\Modules\az_*") {
        $azPSModulePath = (Get-ChildItem "C:\Modules\az_*" -Directory `
            | Sort-Object { [version]$_.Name.Split('_')[-1] } `
            | Select-Object -Last 1).FullName

        Write-Verbose "Found Az module path $azPSModulePath, will be used"
        $env:PSModulePath = ($azPSModulePath + ";" + $newEnvPSModulePath).Trim(";")
    }
}
