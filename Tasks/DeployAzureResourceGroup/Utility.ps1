# Telemetry
$telemetryCodes =
@{
  "AZUREPLATFORM_BlobUploadFailed" = "AZUREPLATFORM_BlobUploadFailed";
  "AZUREPLATFORM_UnknownGetRMVMError" = "AZUREPLATFORM_UnknownGetRMVMError";

  "DEPLOYMENT_CSMDeploymentFailed" = "DEPLOYMENT_CSMDeploymentFailed";
  "DEPLOYMENT_Failed" = "DEP001";
  "DEPLOYMENT_FetchPropertyFromMap" = "DEPLOYMENT_FetchPropertyFromMap";
  "DEPLOYMENT_PerformActionFailed" = "DEPLOYMENT_PerformActionFailed";

  "PREREQ_AzureRMModuleNotFound" = "PREREQ_AzureRMModuleNotFound";
  "PREREQ_InvalidFilePath" = "PREREQ_InvalidFilePath";
  "PREREQ_InvalidServiceConnectionType" = "PREREQ_InvalidServiceConnectionType";
  "PREREQ_NoOutputVariableForSelectActionInAzureRG" = "PREREQ004";
  "PREREQ_NoResources" = "PREREQ003";
  "PREREQ_NoVMResources" = "PREREQ_NoVMResources";
  "PREREQ_NoWinRMHTTP_Port" = "PREREQ001";
  "PREREQ_NoWinRMHTTPSPort" = "PREREQ002";
  "PREREQ_StorageAccountNotFound" = "PREREQ_StorageAccountNotFound";
  "PREREQ_UnsupportedAzurePSVerion" = "PREREQ_UnsupportedAzurePSVerion";

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

function Validate-AzurePowershellVersion
{
    $currentVersion =  Get-AzureCmdletsVersion
    $minimumAzureVersion = New-Object System.Version(0, 9, 0)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Write-TaskSpecificTelemetry "PREREQ_UnsupportedAzurePSVerion"
        Throw (Get-LocalizedString -Key "The required minimum version {0} of the Azure Powershell Cmdlets are not installed. You can follow the instructions at {1} to get the latest Azure powershell" -ArgumentList $minimumAzureVersion, "http://aka.ms/azps")
    }

    Write-Verbose -Verbose "Validated the required azure powershell version"
}

function Get-AzureUtility
{
    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose -Verbose "Azure PowerShell version: $currentVersion"
    $minimumAzureVersion = New-Object System.Version(0, 9, 9)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    if(!$versionCompatible)
    {
        Write-Verbose -Verbose "Required AzureUtility: AzureUtilityLTE9.8.ps1"
        return "AzureUtilityLTE9.8.ps1"
    }
    else
    {
        Write-Verbose -Verbose "Required AzureUtility: AzureUtilityGTE1.0.ps1"
        return "AzureUtilityGTE1.0.ps1"
    }
}

function Create-AzureResourceGroup
{
    param([string] $csmFile,
          [string] $csmParametersFile,
          [string] $resourceGroupName,
          [string] $location,
          [string] $overrideParameters)

    $csmFileName = [System.IO.Path]::GetFileNameWithoutExtension($csmFile)

    #Create csm parameter object
    $csmAndParameterFiles = Get-CsmAndParameterFiles -csmFile $csmFile -csmParametersFile $csmParametersFile

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\"))
    {
        $csmParametersFileContent = [System.IO.File]::ReadAllText($csmAndParameterFiles["csmParametersFile"])
    }
    else
    {
        $csmParametersFileContent = [String]::Empty
    }

    $csmParametersObject = Get-CsmParameterObject -csmParameterFileContent $csmParametersFileContent
    $csmFile = $csmAndParameterFiles["csmFile"]

    if([string]::IsNullOrEmpty($csmFile) -eq $false -and [string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($location) -eq $false)
    {
        # Create azure resource group
        Create-AzureResourceGroupIfNotExist -resourceGroupName $resourceGroupName -location $location
        $startTime = Get-Date
        Set-Variable -Name startTime -Value $startTime -Scope "Global"

        # Deploying CSM Template
        $deploymentDetails = Deploy-AzureResourceGroup -csmFile $csmFile -csmParametersObject $csmParametersObject -resourceGroupName $resourceGroupName -overrideParameters $overrideParameters

        $azureResourceGroupDeployment = $deploymentDetails["azureResourceGroupDeployment"]
        $deploymentError = $deploymentDetails["deploymentError"]

        if ($azureResourceGroupDeployment)
        {
            Write-Verbose -Verbose "[Azure Resource Manager]Created resource group deployment with name $resourceGroupName"
            Set-Variable -Name azureResourceGroupDeployment -Value $azureResourceGroupDeployment -Scope "Global"
            Get-MachineLogs -ResourceGroupName $resourceGroupName

            if($deploymentError)
            {
                Write-TaskSpecificTelemetry "DEPLOYMENT_CSMDeploymentFailed"
                Set-Variable -Name deploymentError -Value $deploymentError -Scope "Global"

                foreach($error in $deploymentError)
                {
                    Write-Error $error -ErrorAction Continue
                }

                Write-Error (Get-LocalizedString -Key "Resource group deployment '{0}' failed" -ArgumentList $resourceGroupName) -ErrorAction Continue
            }
            else
            {
                Write-Host (Get-LocalizedString -Key "Successfully created resource group deployment with name '{0}'" -ArgumentList $resourceGroupName)
            }

            Write-Verbose -Verbose "End of resource group deployment logs"
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

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        $VmInstanceViews = Get-AllVmInstanceView -ResourceGroupName $resourceGroupName

        foreach($vmName in $VmInstanceViews.Keys)
        {
            vmInstanceView = $VmInstanceViews[$vmName]

            Write-Verbose -Verbose "Machine $vmName status:"
            foreach($status in $vmInstanceView.Statuses)
            {
                Print-OperationLog -Log $status
            }

            if($vmInstanceView.VMAgent.ExtensionHandlers)
            {
                Write-Verbose -Verbose "Machine $name VM agent status:"
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
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern '{0}'. There can be only one" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
            throw (Get-LocalizedString -Key "No files were found to deploy with search pattern '{0}'" -ArgumentList $pattern)
        }

        return $files
    }
}

function Get-File($pattern)
{
    #Find the File based on pattern
    Write-Verbose -Verbose "Finding files based on $pattern"
    $filesMatchingPattern = Find-Files -SearchPattern "$pattern"

    Write-Verbose -Verbose "Files Matching Pattern: $filesMatchingPattern"

    #Ensure that at most a single file is found
    $file = Get-SingleFile $filesMatchingPattern $pattern

    return $file
}

function Validate-DeploymentFileAndParameters
{
    param([string]$csmFile,
          [string]$csmParametersFile)

    if (!(Test-Path -Path $csmFile -PathType Leaf))
    {
        Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
        throw (Get-LocalizedString -Key "Please specify a complete and a valid template file path")
    }

    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\") -and !(Test-Path -Path $csmParametersFile -PathType Leaf))
    {
         Write-TaskSpecificTelemetry "PREREQ_InvalidFilePath"
         throw (Get-LocalizedString -Key "Please specify a complete and a valid template parameters file path")
    }
}

function Get-CsmParameterObject
{
    param([string]$csmParameterFileContent)

    if ([string]::IsNullOrEmpty($csmParameterFileContent) -eq $false)
    {
        Write-Verbose "Generating csm parameter object" -Verbose

        $csmJObject = [Newtonsoft.Json.Linq.JObject]::Parse($csmParameterFileContent)
        $newParametersObject = New-Object System.Collections.Hashtable([System.StringComparer]::InvariantCultureIgnoreCase)

        if($csmJObject.ContainsKey("parameters") -eq $true)
        {
            $parameters = $csmJObject.GetValue("parameters")
            $parametersObject  = $parameters.ToObject([System.Collections.Hashtable])
        }
        else
        {
            $parametersObject = $csmJObject.ToObject([System.Collections.Hashtable])
        }

        foreach($key in $parametersObject.Keys)
        {
            $parameterValue = $parametersObject[$key] -as [Newtonsoft.Json.Linq.JObject]
            $newParametersObject.Add($key, $parameterValue["value"])
        }

        Write-Verbose "Generated the parameter object" -Verbose

        return $newParametersObject
    }
}

function Print-OperationLog
{
    param([System.Object]$log)

    if($log)
    {
        $status = $log.DisplayStatus
        if([string]::IsNullOrEmpty($status) -eq $false)
        {
            Write-Verbose -Verbose "Status: $status"
        }

        $message = $log.Message
        if([string]::IsNullOrEmpty($message) -eq $false)
        {
            Write-Verbose -Verbose "Message: $message"
        }
    }
}

function Get-CsmAndParameterFiles
{
    param([string] $csmFile,
          [string] $csmParametersFile)

    #Find the matching deployment definition File
    $csmFile = Get-File $csmFile
    Write-Verbose -Verbose "deploymentDefinitionFile = $csmFile"

    # csmParametersFile value would be  BUILD_SOURCESDIRECTORY when left empty in UI.
    if ($csmParametersFile -ne $env:BUILD_SOURCESDIRECTORY -and $csmParametersFile -ne [String]::Concat($env:BUILD_SOURCESDIRECTORY, "\"))
    {
        #Find the matching deployment definition Parameter File
        $csmParametersFile = Get-File $csmParametersFile
        Write-Verbose -Verbose "deploymentDefinitionParametersFile = $csmParametersFile"
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
            Invoke-OperationOnResourcegroup -resourceGroupName $resourceGroupName -operationName $action
            break
        }

        "DeleteRG" {
            Delete-ResourceGroup -resourceGroupName $resourceGroupName
            break
        }

        default {
            Write-TaskSpecificTelemetry "PREREQ_InvalidActionProvided"
            throw (Get-LocalizedString -Key "Action '{0}' is not supported on the provider '{1}'" -ArgumentList $action, "Azure")
        }
    }
}

function Invoke-OperationOnResourcegroup
{
     param([string]$resourceGroupName,
           [string]$operationName)

    Write-Verbose "Entered perform action $operationName on machines for resource group $resourceGroupName" -Verbose

    $machines = Get-AzureVMsInResourceGroup -resourceGroupName $resourceGroupName

    if(! $machines)
    {
        Write-Verbose "Resource group $resourceGroupName has no machines in it" -Verbose
        return
    }

    Foreach($machine in $machines)
    {
        $machineName = $machine.Name
        $response = Invoke-OperationOnMachine -resourceGroupName $resourceGroupName -machineName $machine.Name -operationName $operationName

        if($response.Status -ne "Succeeded")
        {
            Write-TaskSpecificTelemetry "DEPLOYMENT_PerformActionFailed"
            Write-Error (Get-LocalizedString -Key "Operation '{0}' failed on the machine '{1}'" -ArgumentList $operationName, $machine.Name)
            throw $response.Error
        }
        else
        {
            Write-Verbose "'$operationName' operation on the machine '$machineName' succeeded" -Verbose
        }
        
        Write-Verbose "Call to provider to perform operation '$operationName' on the machine '$machineName' completed" -Verbose
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
              throw (Get-LocalizedString -Key "Tried to invoke an invalid operation: '{0}'" -ArgumentList $operationName)
         }
    }

    $response
}

function Instantiate-Environment
{
    param([string]$resourceGroupName,
          [string]$outputVariable)

    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    $azureVMsDetails = Get-AzureClassicVMsDetailsInResourceGroup -resourceGroupName $resourceGroupName
    if($azureVMsDetails.Count -eq 0)
    {
        $azureVMsDetails = Get-AzureVMsDetailsInResourceGroup -resourceGroupName $resourceGroupName	
    }

    if ($azureVMsDetails.Count -eq 0)
    {
        Write-TaskSpecificTelemetry "PREREQ_NoVMResources"
        throw (Get-LocalizedString -Key "No VMs found in resource group: '{0}'. Could not register environment in the output variable: '{1}'" -ArgumentList $resourceGroupName, $outputVariable)
    }

    $resources = @()
    foreach ($resource in $azureVMsDetails.Keys)
    {
        $resourceProperties = $azureVMsDetails[$resource]
        $resourceFQDN = $resourceProperties.fqdn            
        $resourceWinRMHttpsPort = $resourceProperties.winRMHttpsPort

        $machineSpec = $resourceFQDN + ":" + $resourceWinRMHttpsPort
        $resources += $machineSpec
    }

    $machineSpecification = $resources -join ","

    Write-Verbose "Starting Register-Environment cmdlet call for resource group : $resourceGroupName" -Verbose
    $environment = Register-Environment -EnvironmentName $outputVariable -EnvironmentSpecification $machineSpecification -WinRmProtocol "HTTPS" -Connection $connection -TaskContext $distributedTaskContext
    Write-Verbose "Completed Register-Environment cmdlet call for resource group : $resourceGroupName" -Verbose

    Write-Verbose "Adding environment $outputVariable to output variables" -Verbose
    Set-TaskVariable -Variable $outputVariable -Value $outputVariable
    Write-Verbose "Added the environmnent $outputVariable to output variable" -Verbose
}

function Get-MachinesFqdnsForLB
{
    param([string]$resourceGroupName,
          [Object]$publicIPAddressResources,
          [Object]$networkInterfaceResources,
          [Object]$frontEndIPConfigs,
          [System.Collections.Hashtable]$fqdnMap)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources -and $frontEndIPConfigs)
    {
        Write-Verbose "Trying to get FQDN for the RM azureVM resources from resource group: $resourceGroupName" -Verbose

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

    Write-Verbose "Got FQDN for the RM azureVM resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-FrontEndPorts
{
    param([string]$backEndPort,
          [System.Collections.Hashtable]$portList,
          [Object]$networkInterfaceResources,
          [Object]$inboundRules
          )

    if([string]::IsNullOrEmpty($backEndPort) -eq $false -and $networkInterfaceResources -and $inboundRules)
    {
        Write-Verbose "Trying to get front end ports for $backEndPort" -Verbose

        $filteredRules = $inboundRules | Where-Object {$_.BackendPort -eq $backEndPort}

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

function Get-MachineNameFromId
{
    param([string]$resourceGroupName,
          [System.Collections.Hashtable]$map,
          [string]$mapParameter,
          [Object]$azureVMResources,
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
    param([string]$resourceGroupName,
          [Object]$publicIPAddressResources,
          [Object]$networkInterfaceResources,
          [Object]$azureVMResources,
          [System.Collections.Hashtable]$fqdnMap)

    if([string]::IsNullOrEmpty($resourceGroupName) -eq $false -and $publicIPAddressResources -and $networkInterfaceResources)
    {
        Write-Verbose "Trying to get FQDN for the RM azureVM resources from resource Group $resourceGroupName" -Verbose

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

        $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -azureVMResources $azureVMResources -ThrowOnTotalUnavaialbility $true
    }

    Write-Verbose "Got FQDN for the RM azureVM resources from resource Group $resourceGroupName" -Verbose

    return $fqdnMap
}

function Get-AzureVMsDetailsInResourceGroup
{
    param([string]$resourceGroupName)

    [hashtable]$fqdnMap = @{};
    [hashtable]$winRmHttpsPortMap = @{}
    [hashtable]$vmResourcesDetails = @{}

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        $ResourcesDetails = Get-AzureVMsConnectionDetailsInResourceGroup -resourceGroupName $resourceGroupName	

        $azureVMResources = $ResourcesDetails["azureVMResources"]
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

                $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $resourceGroupName -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap
                $winRmHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRmHttpsPortMap -networkInterfaceResources $networkInterfaceResources -inboundRules $inboundRules
            }

            $fqdnMap = Get-MachineNameFromId -resourceGroupName $resourceGroupName -Map $fqdnMap -MapParameter "FQDN" -azureVMResources $azureVMResources -ThrowOnTotalUnavaialbility $true
            $winRmHttpsPortMap = Get-MachineNameFromId -Map $winRmHttpsPortMap -MapParameter "Front End port" -azureVMResources $azureVMResources -ThrowOnTotalUnavaialbility $false
        }
        else
        {
            $fqdnMap = Get-MachinesFqdns -resourceGroupName $resourceGroupName -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources -azureVMResources $azureVMResources -fqdnMap $fqdnMap
            $winRmHttpsPortMap = New-Object 'System.Collections.Generic.Dictionary[string, string]'
        }

        foreach ($resource in $azureVMResources)
        {
            $resourceName = $resource.Name
            $resourceFQDN = $fqdnMap[$resourceName]
            $resourceWinRmHttpsPort = $winRmHttpsPortMap[$resourceName]
            if([string]::IsNullOrWhiteSpace($resourceWinRmHttpsPort))
            {
                Write-Verbose -Verbose "Defaulting WinRmHttpsPort of $resourceName to 5986"
                $resourceWinRmHttpsPort = "5986"
            }

            $resourceProperties = @{}
            $resourceProperties.Name = $resourceName
            $resourceProperties.fqdn = $resourceFQDN
            $resourceProperties.winRMHttpsPort = $resourceWinRmHttpsPort

            $vmResourcesDetails.Add($resourceName, $resourceProperties)
        }
        return $vmResourcesDetails
    }
}