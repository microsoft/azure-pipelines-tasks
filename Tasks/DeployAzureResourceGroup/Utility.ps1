# Telemetry
$telemetryCodes =
@{
  "AZUREPLATFORM_BlobUploadFailed" = "AZUREPLATFORM_BlobUploadFailed";
  "AZUREPLATFORM_UnknownGetRMVMError" = "AZUREPLATFORM_UnknownGetRMVMError";

  "DEPLOYMENT_CSMDeploymentFailed" = "DEPLOYMENT_CSMDeploymentFailed";
  "DEPLOYMENT_Failed" = "DEP001";
  "DEPLOYMENT_FetchPropertyFromMap" = "DEPLOYMENT_FetchPropertyFromMap";
  "DEPLOYMENT_PerformActionFailed" = "DEPLOYMENT_PerformActionFailed";

  "ENABLEWINRM_ProvisionVmCustomScriptFailed" = "ENABLEWINRM_ProvisionVmCustomScriptFailed"
  "ENABLEWINRM_ExecutionOfVmCustomScriptFailed" = "ENABLEWINRM_ExecutionOfVmCustomScriptFailed"
  "ADDWINRM_NetworkSecurityRuleConfigFailed" = "ADDWINRM_NetworkSecurityRuleConfigFailed"

  "PREREQ_AzureRMModuleNotFound" = "PREREQ_AzureRMModuleNotFound";
  "PREREQ_InvalidFilePath" = "PREREQ_InvalidFilePath";
  "PREREQ_InvalidServiceConnectionType" = "PREREQ_InvalidServiceConnectionType";
  "PREREQ_NoOutputVariableForSelectActionInAzureRG" = "PREREQ004";
  "PREREQ_NoResources" = "PREREQ003";
  "PREREQ_NoVMResources" = "PREREQ_NoVMResources";
  "PREREQ_NoWinRMHTTP_Port" = "PREREQ001";
  "PREREQ_NoWinRMHTTPSPort" = "PREREQ002";
  "PREREQ_StorageAccountNotFound" = "PREREQ_StorageAccountNotFound";
  "PREREQ_UnsupportedAzurePSVersion" = "PREREQ_UnsupportedAzurePSVersion";

  "UNKNOWNDEP_Error" = "UNKNOWNDEP_Error";
  "UNKNOWNPREDEP_Error" = "UNKNOWNPREDEP001";
 }

function Write-Telemetry
{
    [CmdletBinding()]
    param
    (
        [Parameter(Mandatory=$True,Position=1)]
        [string]$codeKey,
        [Parameter(Mandatory=$True,Position=2)]
        [string]$taskId
    )

    if($telemetrySet)
    {
        return
    }

    $code = $telemetryCodes[$codeKey]
    $telemetryString = "##vso[task.logissue type=error;code=" + $code + ";TaskId=" + $taskId + ";]"

    Write-Host $telemetryString
    $telemetrySet = $true
}

function Write-TaskSpecificTelemetry
{
    param([string]$codeKey)

    Write-Telemetry "$codeKey" "94A74903-F93F-4075-884F-DC11F34058B4"
}

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

function Validate-AzurePowerShellVersion
{
    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Write-TaskSpecificTelemetry "PREREQ_UnsupportedAzurePSVersion"
        Throw (Get-VstsLocString -Key "ARG_UnsupportedAzurePSVersion" -ArgumentList $minimumAzureVersion, "https://aka.ms/azps")
    }

    Write-Verbose "Validated the required azure powershell version"
}

function Check-AzureRMInstalled
{
    if(!(Get-Module -Name "AzureRM*" -ListAvailable))
    {
        Write-TaskSpecificTelemetry "PREREQ_AzureRMModuleNotFound"
        throw (Get-VstsLocString -Key "ARG_AzureRMModuleNotFound" -ArgumentList "https://aka.ms/azps")
    }
}

function Get-AzureUtility
{
    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose "Azure PowerShell version: $currentVersion"

    $AzureVersion099 = New-Object System.Version(0, 9, 9)
    $AzureVersion103 = New-Object System.Version(1, 0, 3)

    $azureUtilityVersion098 = "AzureUtilityLTE9.8.ps1"
    $azureUtilityVersion100 = "AzureUtilityGTE1.0.ps1"
    $azureUtilityVersion110 = "AzureUtilityGTE1.1.0.ps1"

    if(!(Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $AzureVersion099))
    {
        $azureUtilityRequiredVersion = $azureUtilityVersion098
    }
    elseif(!(Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $AzureVersion103))
    {
        Check-AzureRMInstalled
        $azureUtilityRequiredVersion = $azureUtilityVersion100
    }
    else
    {
        Check-AzureRMInstalled
        $azureUtilityRequiredVersion = $azureUtilityVersion110
    }

    Write-Verbose "Required AzureUtility: $azureUtilityRequiredVersion"
    return $azureUtilityRequiredVersion
}

function Create-AzureResourceGroup
{
    param([string]$csmFile,
          [string]$csmParametersFile,
          [string]$resourceGroupName,
          [string]$location,
          [string]$overrideParameters)

    $csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)

    #Create csm parameter object
    $csmAndParameterFiles = Get-CsmAndParameterFiles -csmFile $csmFile -csmParametersFile $csmParametersFile
    $csmFile = $csmAndParameterFiles["csmFile"]

    if(-not [string]::IsNullOrEmpty($csmFile) -and -not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($location))
    {
        # Create azure resource group
        Create-AzureResourceGroupIfNotExist -resourceGroupName $resourceGroupName -location $location

        # Deploying CSM Template
        $deploymentDetails = Deploy-AzureResourceGroup -csmFile $csmFile -csmParametersFile $csmParametersFile -resourceGroupName $resourceGroupName -overrideParameters $overrideParameters

        $azureResourceGroupDeployment = $deploymentDetails["azureResourceGroupDeployment"]
        $deploymentError = $deploymentDetails["deploymentError"]

        if ($azureResourceGroupDeployment)
        {
            Write-Host "[Azure Resource Manager]Created resource group deployment with name $resourceGroupName"
            Get-MachineLogs -ResourceGroupName $resourceGroupName

            if($deploymentError)
            {
                Write-TaskSpecificTelemetry "DEPLOYMENT_CSMDeploymentFailed"

                foreach($error in $deploymentError)
                {
                    Write-Error $error -ErrorAction Continue
                }

                throw (Get-VstsLocString -Key "ARG_DeploymentFailed" -ArgumentList $resourceGroupName)
            }
            else
            {
                Write-Host (Get-VstsLocString -Key "ARG_DeploymentSucceeded" -ArgumentList $resourceGroupName)
            }

            Write-Verbose "End of resource group deployment logs"
            return $azureResourceGroupDeployment
        }
        else
        {
            Write-TaskSpecificTelemetry "DEPLOYMENT_CSMDeploymentFailed"
            Throw $deploymentError
        }
    }
}

function Get-MachineLogs
{
    param([string]$resourceGroupName)

    if (-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        $VmInstanceViews = Get-AllVMInstanceView -ResourceGroupName $resourceGroupName

        foreach($vmName in $VmInstanceViews.Keys)
        {
            $vmInstanceView = $VmInstanceViews[$vmName]

            Write-Verbose "Machine $vmName status:"
            foreach($status in $vmInstanceView.Statuses)
            {
                Print-OperationLog -Log $status
            }

            if($vmInstanceView.VMAgent.ExtensionHandlers)
            {
                Write-Verbose "Machine $name VM agent status:"
                foreach($extensionHandler in $vmInstanceView.VMAgent.ExtensionHandlers)
                {
                    Print-OperationLog -Log $extensionHandler.Status
                }
            }

            foreach($extension in $vmInstanceView.Extensions)
            {
                $extensionName = $extension.Name

                Write-Verbose -Verbose "Extension $extensionName status:"
                foreach($status in $extension.Statuses)
                {
                    Print-OperationLog -Log $status
                }

                Write-Verbose -Verbose "Extension $extensionName sub status:"
                foreach($status in $extension.SubStatuses)
                {
                    Print-OperationLog -Log $status
                }
            }
        }
    }
}

function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
        throw (Get-VstsLocString -Key "ARG_InvalidFilePath" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
            throw (Get-VstsLocString -Key "ARG_FileNotFound" -ArgumentList $pattern)
        }

        return $files
    }
}

function Get-File($pattern)
{
    #Find the File based on pattern
    Write-Verbose "Finding files based on $pattern"
    $filesMatchingPattern = Find-VstsFiles -LegacyPattern "$pattern"

    Write-Verbose "Files Matching Pattern: $filesMatchingPattern"

    #Ensure that at most a single file is found
    $file = Get-SingleFile $filesMatchingPattern $pattern

    return $file
}

function Validate-DeploymentFileAndParameters
{
    param([string]$csmFile,
          [string]$csmParametersFile)

    if (!(Test-Path -LiteralPath $csmFile -PathType Leaf))
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
        throw (Get-VstsLocString -Key "ARG_SpecifyValidTemplatePath")
    }

    if ($csmParametersFile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\") -and !(Test-Path -LiteralPath $csmParametersFile -PathType Leaf))
    {
         Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
         throw (Get-VstsLocString -Key "ARG_SpecifyValidParametersPath")
    }
}

function Print-OperationLog
{
    param([System.Object]$log)

    if($log)
    {
        $status = $log.DisplayStatus
        if(-not [string]::IsNullOrEmpty($status))
        {
            Write-Verbose "Status: $status" -verbose
        }

        $message = $log.Message
        if(-not [string]::IsNullOrEmpty($message))
        {
            Write-Verbose "Message: $message" -verbose
        }
    }
}

function Get-CsmAndParameterFiles
{
    param([string]$csmFile,
          [string]$csmParametersFile)

    #Find the matching deployment definition File
    $csmFile = Get-File $csmFile
    Write-Verbose "deploymentDefinitionFile = $csmFile"

    # csmParametersFile value would be  SYSTEM_DEFAULTWORKINGDIRECTORY when left empty in UI.
    if ($csmParametersFile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\"))
    {
        #Find the matching deployment definition Parameter File
        $csmParametersFile = Get-File $csmParametersFile
        Write-Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
    }

    Validate-DeploymentFileAndParameters -csmFile $csmFile -csmParametersFile $csmParametersFile

    @{"csmFile" = $($csmFile); "csmParametersFile" = $($csmParametersFile)}
}

function Perform-Action
{
    param([string]$action,
          [string]$resourceGroupName)

    Switch ($Action)
    {
        { @("Start", "Stop", "Restart", "Delete") -contains $_ } {
            Invoke-OperationOnResourceGroup -resourceGroupName $resourceGroupName -operationName $action
            break
        }

        "DeleteRG" {
            Delete-ResourceGroup -resourceGroupName $resourceGroupName
            break
        }

        default {
            Write-TaskSpecificTelemetry "PREREQ_InvalidActionProvided"
            throw (Get-VstsLocString -Key "ARG_ActionNotSupported" -ArgumentList $action, "Azure")
        }
    }
}

function Invoke-OperationOnResourceGroup
{
     param([string]$resourceGroupName,
           [string]$operationName)

    Write-Verbose "Entered perform action $operationName on machines for resource group $resourceGroupName"

    $machines = Get-AzureRMVMsInResourceGroup -resourceGroupName $resourceGroupName

    if(! $machines)
    {
        Write-Host "Resource group $resourceGroupName has no machines in it"
        return
    }

    Foreach($machine in $machines)
    {
        $machineName = $machine.Name
        $response = Invoke-OperationOnMachine -resourceGroupName $resourceGroupName -machineName $machine.Name -operationName $operationName

        if($response.Status -ne "Succeeded")
        {
            Write-TaskSpecificTelemetry "DEPLOYMENT_PerformActionFailed"
            Write-Error (Get-VstsLocString -Key "ARG_OperationFailedOnMachine" -ArgumentList $operationName, $machine.Name)
            throw $response.Error
        }
        else
        {
            Write-Host "'$operationName' operation on the machine '$machineName' succeeded"
        }
        
        Write-Verbose "Call to provider to perform operation '$operationName' on the machine '$machineName' completed"
    }
}

function Invoke-OperationOnMachine
{
    param([string]$resourceGroupName,
          [string]$machineName,
          [string]$operationName)

    # Performs the operation on provider based on the operation name.
    Switch ($operationName)
    {
         "Start" {
             $response = Start-Machine -resourceGroupName $resourceGroupName -machineName $machineName
         }

         "Stop" {
             $response = Stop-Machine -resourceGroupName $resourceGroupName -machineName $machineName
         }

         "Restart" {
             $response = Stop-Machine -resourceGroupName $resourceGroupName -machineName $machineName

             if($response.Status -eq "Succeeded")
             {
                $response = Start-Machine -resourceGroupName $resourceGroupName -machineName $machineName
             }
         }

         "Delete" {
             $response = Delete-Machine -resourceGroupName $resourceGroupName -machineName $machineName
         }

         default {
              Write-TaskSpecificTelemetry "PREREQ_InvalidActionProvided"
              throw (Get-VstsLocString -Key "ARG_InvokeInvalidOperation" -ArgumentList $operationName)
         }
    }

    $response
}

function Instantiate-Environment
{
    param([string]$resourceGroupName,
          [string]$outputVariable,
          [string]$enableDeploymentPrerequisites)

    $azureVMResources = Get-AzureClassicVMsInResourceGroup -resourceGroupName $resourceGroupName
    $azureVMsDetails = Get-AzureClassicVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureClassicVMResources $azureVMResources
    if($azureVMsDetails.Count -eq 0)
    {
        $azureVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $resourceGroupName
        $azureVMsDetails = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureRMVMResources $azureVMResources -enableDeploymentPrerequisites $enableDeploymentPrerequisites
        $tagsList = Get-AzureResourcesTags -azureVMResources $azureVMResources -azureVMsDetails $azureVMsDetails
    }

    if ($azureVMsDetails.Count -eq 0)
    {
        Write-TaskSpecificTelemetry "PREREQ_NoVMResources"
        throw (Get-VstsLocString -Key "ARG_NoVmsFound" -ArgumentList $resourceGroupName, $outputVariable)
    }

    $resources = @()
    foreach ($resource in $azureVMsDetails.Keys)
    {
        $resourceProperties = $azureVMsDetails[$resource]
        $resourceFQDN = $resourceProperties.fqdn
        $resourceWinRMHttpsPort = $resourceProperties.winRMHttpsPort

        if(-not [string]::IsNullOrEmpty($resourceFQDN))
        {
            $machineSpec = $resourceFQDN + ":" + $resourceWinRMHttpsPort
            $resources += $machineSpec
        }
    }

    $machineSpecification = $resources -join ","

    Write-Verbose "Starting Register-Environment cmdlet call for resource group : $resourceGroupName"
    $environment = Register-Environment -EnvironmentName $outputVariable -EnvironmentSpecification $machineSpecification -WinRmProtocol "HTTPS" -TagsList $tagsList
    Write-Verbose "Completed Register-Environment for : $resourceGroupName, converting environment as json and setting as output variable" -verbose       
    $envStr = $environment.ToString() -replace "`n|`r"
    Write-Host "##vso[task.setvariable variable=$outputVariable;issecret=true;]$envStr"  
    Write-Verbose "Added the environment $outputVariable to output variable"
}

function Get-AzureResourcesTags
{
    param([object]$azureVMResources,
          [object]$azureVMsDetails)

    $tagsList = New-Object 'system.collections.generic.dictionary[[string],[system.collections.generic.dictionary[[string],[string]]]]'

    if ($azureVMResources)
    {
        foreach($resource in $azureVMResources)
        {
            $resourceName = $resource.Name
            if(-not ($resource.Tags -eq $null -or $resource.Tags.Count -eq 0))
            {
                $resourceFqdn = ($azureVMsDetails[$resourceName]).fqdn
                $resourcePort = ($azureVMsDetails[$resourceName]).winRMHttpsPort
                $resourceTags = $resource.Tags

                Write-Verbose "Adding tags: '$resourceTags' for resource: '$resourceFqdn + ':' + $resourcePort'"
                $tagsList.Add($resourceFqdn + ':' + $resourcePort, $resource.Tags)
            }
        }
    }

    return $tagsList
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
            Write-Verbose "Map for $mapParameter : " -Verbose
            Write-Verbose ($map | Format-List | Out-String) -Verbose

            Write-Verbose "azureRMVMResources: " -Verbose
            Write-Verbose ($azureRMVMResources | Format-List | Out-String) -Verbose
        }

        Write-Verbose "throwOnTotalUnavailability: $throwOnTotalUnavailability" -Verbose

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
                throw (Get-VstsLocString -Key "ARG_AllResourceNotFound" -ArgumentList $mapParameter, $resourceGroupName)
            }
            else
            {
                if($errorCount -gt 0 -and $errorCount -ne $azureRMVMResources.Count)
                {
                    Write-Warning (Get-VstsLocString -Key "ARG_ResourceNotFound" -ArgumentList $mapParameter, $errorCount, $resourceGroupName)
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
                if(-not [string]::IsNullOrEmpty($publicIP.DnsSettings.Fqdn))
                {
                    $fqdnMap[$publicIp.IpConfiguration.Id.ToLower()] =  $publicIP.DnsSettings.Fqdn
                }
                elseif(-not [string]::IsNullOrEmpty($publicIP.IpAddress))
                {
                    $fqdnMap[$publicIp.IpConfiguration.Id.ToLower()] =  $publicIP.IpAddress
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
                        $fqdnMap[$nic.VirtualMachine.Id.ToLower()] = $fqdn
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

function Get-AzureRMVMsConnectionDetailsInResourceGroup
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources,
          [string]$enableDeploymentPrerequisites)

    [hashtable]$fqdnMap = @{}
    $winRmHttpsPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
    [hashtable]$vmResourcesDetails = @{}
    $debugLogsFlag= $env:system_debug

    if (-not [string]::IsNullOrEmpty($resourceGroupName) -and $azureRMVMResources)
    {
        $ResourcesDetails = Get-AzureRMResourceGroupResourcesDetails -resourceGroupName $resourceGroupName -azureRMVMResources $azureRMVMResources

        $networkInterfaceResources = $ResourcesDetails["networkInterfaceResources"]
        $publicIPAddressResources = $ResourcesDetails["publicIPAddressResources"]
        $loadBalancerResources = $ResourcesDetails["loadBalancerResources"]

        if($loadBalancerResources)
        {
            foreach($lbName in $loadBalancerResources.Keys)
            {
                $lbDetails = $loadBalancerResources[$lbName]
                $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
                $inboundRules = $lbDetails["inboundRules"]

                $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName -publicIPAddressResources $publicIPAddressResources `
                                                  -networkInterfaceResources $networkInterfaceResources -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap -debugLogsFlag $debugLogsFlag
                $winRmHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRmHttpsPortMap -networkInterfaceResources $networkInterfaceResources `
                                                       -inboundRules $inboundRules -debugLogsFlag $debugLogsFlag
            }

            $winRmHttpsPortMap = Get-MachineNameFromId -Map $winRmHttpsPortMap -MapParameter "Front End port" -azureRMVMResources $azureRMVMResources `
                                                       -ThrowOnTotalUnavailability $false -debugLogsFlag $debugLogsFlag
        }

        $fqdnMap = Get-MachinesFqdnsForPublicIP -resourceGroupName $resourceGroupName -publicIPAddressResources $publicIPAddressResources `
                                                -networkInterfaceResources $networkInterfaceResources -azureRMVMResources $azureRMVMResources -fqdnMap $fqdnMap -debugLogsFlag $debugLogsFlag
        $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -azureRMVMResources $azureRMVMResources `
                                                -ThrowOnTotalUnavailability $true -debugLogsFlag $debugLogsFlag

        foreach ($resource in $azureRMVMResources)
        {
            $resourceName = $resource.Name
            $resourceId = $resource.Id
            $resourceFQDN = $fqdnMap[$resourceName]
            $resourceWinRmHttpsPort = $winRmHttpsPortMap[$resourceName]
            if([string]::IsNullOrWhiteSpace($resourceWinRmHttpsPort))
            {
                Write-Verbose "Defaulting WinRmHttpsPort of $resourceName to 5986"
                $resourceWinRmHttpsPort = "5986"
            }

            $resourceProperties = @{}
            $resourceProperties.Name = $resourceName
            $resourceProperties.fqdn = $resourceFQDN
            $resourceProperties.winRMHttpsPort = $resourceWinRmHttpsPort

            $vmResourcesDetails.Add($resourceName, $resourceProperties)

            if ($enableDeploymentPrerequisites -eq "true")
            {
                Write-Verbose "Enabling winrm for virtual machine $resourceName"
                Add-AzureVMCustomScriptExtension -resourceGroupName $resourceGroupName -vmId $resourceId -vmName $resourceName -dnsName $resourceFQDN -location $resource.Location
            }
        }

        return $vmResourcesDetails
    }
}

function Validate-CustomScriptExecutionStatus
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$extensionName)

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
        $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName
        throw (Get-VstsLocString -Key "ARG_SetExtensionFailed" -ArgumentList $extensionName, $vmName, $errMessage)
    }

    Write-Verbose "Validated the script execution successfully"
}

function Is-WinRMCustomScriptExtensionExists
{
    param([string]$resourceGroupName,
    [string]$vmName,
    [string]$extensionName)

    $isExtensionExists = $true
    $removeExtension = $false
    try
    {
        $customScriptExtension = Get-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName

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
                        Validate-CustomScriptExecutionStatus -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName
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
        $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName
        $isExtensionExists = $false
    }

    $isExtensionExists
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
        Write-TaskSpecificTelemetry "ADDWINRM_NetworkSecurityRuleConfigFailed"
        Write-Warning (Get-VstsLocString -Key "ARG_NetworkSecurityConfigFailed" -ArgumentList $_.exception.message)
    }
}

function Add-AzureVMCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmId,
          [string]$vmName,
          [string]$dnsName,
          [string]$location)

    $configWinRMScriptFile="https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/ConfigureWinRM.ps1"
    $makeCertFile="https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/makecert.exe"
    $winrmConfFile="https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/201-vm-winrm-windows/winrmconf.cmd"
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
        $isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName
        Write-Verbose "IsExtensionExists: $isExtensionExists"

        if($isExtensionExists)
        {
            Add-WinRMHttpsNetworkSecurityRuleConfig -resourceGroupName $resourceGroupName -vmId $vmId -ruleName $ruleName -rulePriotity $rulePriotity -winrmHttpsPort $winrmHttpsPort                     
            
            Write-Verbose "Skipping the addition of custom script extension '$extensionName' as it already exists"
            return
        }

        $result = Set-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -fileUri $configWinRMScriptFile, $makeCertFile, $winrmConfFile  -run $scriptToRun -argument $dnsName -location $location
        $resultDetails = $result | ConvertTo-Json
        Write-Verbose "Set-AzureMachineCustomScriptExtension completed with response : $resultDetails"

        if($result.Status -ne "Succeeded")
        {
            Write-TaskSpecificTelemetry "ENABLEWINRM_ProvisionVmCustomScriptFailed"

            $response = Remove-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName
            throw (Get-VstsLocString -Key "ARG_SetExtensionFailedForVm" -ArgumentList $extensionName, $vmName, $result.Error.Message)
        }

        Validate-CustomScriptExecutionStatus -resourceGroupName $resourceGroupName -vmName $vmName -extensionName $extensionName
        Add-WinRMHttpsNetworkSecurityRuleConfig -resourceGroupName $resourceGroupName -vmId $vmId -ruleName $ruleName -rulePriotity $rulePriotity -winrmHttpsPort $winrmHttpsPort
    }
    catch
    {
         Write-TaskSpecificTelemetry "ENABLEWINRM_ExecutionOfVmCustomScriptFailed"    
        throw (Get-VstsLocString -Key "ARG_DeploymentPrereqFailed" -ArgumentList $_.exception.message)
    }

    Write-Verbose "Successfully added the custom script extension '$extensionName' for virtual machine '$vmName'"
}

function Enable-WinRMHttpsListener
{
    param([string]$resourceGroupName)
   
    # Get azurerm vms
    $azureVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $resourceGroupName
    if ($azureVMResources.Count -eq 0)
    {
        Write-Verbose "No VMs found in resource group: $resourceGroupName"
        return
    }

    # Below call enables the winrm custom script extension
    $azureVMsDetails = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName -azureRMVMResources $azureVMResources -enableDeploymentPrerequisites $true
}
