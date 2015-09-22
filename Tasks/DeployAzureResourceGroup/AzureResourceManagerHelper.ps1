function Create-AzureResourceGroup
{
    param([string]$csmFile,
          [System.Collections.Hashtable]$csmParametersObject,
          [string]$resourceGroupName,
          [string]$location,
          [string]$overrideParameters)

    if([string]::IsNullOrEmpty($csmFile) -eq $false -and [string]::IsNullOrEmpty($resourceGroupName) -eq $false -and [string]::IsNullOrEmpty($location) -eq $false)
    {
        Create-AzureResourceGroupIfNotExist -resourceGroupName $resourceGroupName -location $location
        $startTime = Get-Date
        Set-Variable -Name startTime -Value $startTime -Scope "Global"

        if (!$csmParametersObject)
        {
            $azureCommand = "New-AzureResourceGroupDeployment"
            $azureCommandArguments = "-Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
            $finalCommand = "`$azureResourceGroupDeployment = $azureCommand $azureCommandArguments"
            Write-Verbose -Verbose "$finalCommand"
            Write-Host "[Azure Resource Manager]Creating resource group deployment with name $resourceGroupName"
            Invoke-Expression -Command $finalCommand
        }
        else
        {
            $azureCommand = "New-AzureResourceGroupDeployment"
            $azureCommandArguments = "-Name `"$resourceGroupName`" -ResourceGroupName `"$resourceGroupName`" -TemplateFile `"$csmFile`" -TemplateParameterObject `$csmParametersObject $overrideParameters -Verbose -ErrorAction silentlycontinue -ErrorVariable deploymentError"
            $finalCommand = "`$azureResourceGroupDeployment = $azureCommand $azureCommandArguments"
            Write-Verbose -Verbose "$finalCommand"
            Write-Host "[Azure Resource Manager]Creating resource group deployment with name $resourceGroupName"
            Invoke-Expression -Command $finalCommand
        }

        if ($azureResourceGroupDeployment)
        {
            Write-Verbose -Verbose "[Azure Resource Manager]Created resource group deployment with name $resourceGroupName"
            Set-Variable -Name azureResourceGroupDeployment -Value $azureResourceGroupDeployment -Scope "Global"
            Get-MachineLogs -ResourceGroupName $resourceGroupName

            if($deploymentError)
            {
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
            Throw $deploymentError
        }
    }
}

function Get-CurrentSubscriptionInformation
{
    $subscription = Get-AzureSubscription -Current -Verbose -ErrorAction Stop

    return $subscription
}

function Refresh-SASToken
{
    param([string]$moduleUrlParameterNames,
    [string]$sasTokenParameterNames,
    [System.Collections.Hashtable]$csmParametersObject,
    [string]$subscriptionId,
    [string]$dscDeployment)

    if ($dscDeployment -eq "true")
    {
        if([string]::IsNullOrEmpty($moduleUrlParameterNames) -eq $true)
        {
            Write-Warning (Get-LocalizedString -Key "Parameter name for the modules url is not specified. Cannot generate SAS token. Refer the csm parameters file for the parameter name")
            return $csmParametersObject
        }

        if([string]::IsNullOrEmpty($sasTokenParameterNames) -eq $true)
        {
            Write-Warning (Get-LocalizedString -Key "Parameter name for the SAS token is not specified. Cannot generate SAS token. Refer the csm parameters file for the parameter name")
            return $csmParametersObject
        }

        $sasTokenParameterNameList = New-Object System.Collections.Generic.List[string]
        $sasTokenParameterNames.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)  | Foreach-Object { if([string]::IsNullOrWhiteSpace($_) -eq $false){ $sasTokenParameterNameList.Add($_) } }
        $moduleUrlParameterNameList = New-Object System.Collections.Generic.List[string]
        $moduleUrlParameterNames.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries) | Foreach-Object { if([string]::IsNullOrWhiteSpace($_) -eq $false){ $moduleUrlParameterNameList.Add($_) } }

        if($sasTokenParameterNameList.Count -ne $moduleUrlParameterNameList.Count)
        {
            throw (Get-LocalizedString -Key "Some module url paramter names do not have a matching sas token paramter name or viceversa. Please verify the lists specified and their formats")
        }

        for($itr = 0; $itr -lt $sasTokenParameterNameList.Count; $itr++)
        {
            $sasTokenParameterNameList[$itr] = $sasTokenParameterNameList[$itr].Trim()
            $moduleUrlParameterNameList[$itr] = $moduleUrlParameterNameList[$itr].Trim()
            if ($csmParametersObject.ContainsKey($sasTokenParameterNameList[$itr]) -eq $false)
            {
                Write-Warning (Get-LocalizedString -Key "'{0}' is not present in the csm parameter file. Specify correct parameter name" -ArgumentList $sasTokenParameterNameList[$itr])
                continue
            }

            if ($csmParametersObject.ContainsKey($moduleUrlParameterNameList[$itr]) -eq $false)
            {
                Write-Warning (Get-LocalizedString -Key "'{0}' is not present in the csm parameter file. Specify correct parameter name" -ArgumentList $moduleUrlParameterNameList[$itr])
                continue
            }

            $fullBlobUri = $csmParametersObject[$moduleUrlParameterNameList[$itr]]
            $uri = $fullBlobUri -as [System.URI]
            if (($uri.AbsoluteURI -ne $null -And $uri.Scheme -match '[http|https]') -eq $false)
            {
                Write-Warning (Get-LocalizedString -Key "'{0}' '{1}' is not in the correct url format" -ArgumentList $moduleUrlParameterNameList[$itr], $fullBlobUri)
                continue
            }

            Write-Verbose -Verbose "Generating SAS token for $fullBlobUri"

            $startTime = Get-Date

            $endTime = $startTime.AddHours(24.0)

            $fullBlobUri = $fullBlobUri.TrimEnd('/')

            $i = $fullBlobUri.LastIndexOf('/')
            if($i -ne -1)
            {
                $blobName = $fullBlobUri.Substring($i + 1)
                $fullBlobUri = $fullBlobUri.Remove($i)
            }

            $i = $fullBlobUri.LastIndexOf('/')
            if($i -ne -1)
            {
                $containerName = $fullBlobUri.Substring($i + 1)
                $fullBlobUri = $fullBlobUri.Remove($i)
            }

            $i = $fullBlobUri.IndexOf('.')
            if($i -ne -1)
            {
                $fullBlobUri = $fullBlobUri.Remove($i)
                $storageAccountName = $fullBlobUri.Substring($fullBlobUri.IndexOf("//") + 2)
            }

            Set-AzureSubscription -SubscriptionId $subscriptionId -CurrentStorageAccountName $storageAccountName

            $token  = New-AzureStorageBlobSASToken -Container $containerName -Blob $blobName -Permission r -StartTime $startTime -ExpiryTime $endTime -Verbose -ErrorAction Stop

            Write-Host (Get-LocalizedString -Key "Generated SAS token for '{0}'" -ArgumentList $uri)

            Write-Verbose -Verbose "Replacing SAS token for parameter $sasTokenParameterNameList[$itr]"

            $csmParametersObject.Remove($sasTokenParameterNameList[$itr])
            $csmParametersObject.Add($sasTokenParameterNameList[$itr], $token)

            Write-Verbose -Verbose "Replaced SAS token for parameter $sasTokenParameterNameList[$itr]"
        }
    }

    return $csmParametersObject
}

function Get-MachineLogs
{
    param([string]$resourceGroupName)

    if ([string]::IsNullOrEmpty($resourceGroupName) -eq $false)
    {
        Write-Verbose -Verbose "[Azure Resource Manager]Getting resource group $resourceGroupName"
        $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -Verbose -ErrorAction Stop
        Write-Verbose -Verbose "[Azure Resource Manager]Got resource group $resourceGroupName"
        Set-Variable -Name azureResourceGroup -Value $azureResourceGroup -Scope "Global"

        $azureResourceGroupResources = $azureResourceGroup.Resources |  Where-Object {$_.ResourceType -eq "Microsoft.Compute/virtualMachines"}

        foreach($resource in $azureResourceGroupResources)
        {
            $name = $resource.Name
            Write-Verbose -Verbose "[Azure Resource Manager]Getting VM $name from resource group $resourceGroupName"
            $vmInstanceView = Get-AzureVM -Name $resource.Name -ResourceGroupName $resourceGroupName -Status -Verbose -ErrorAction Stop
            Write-Verbose -Verbose "[Azure Resource Manager]Got VM $name from resource group $resourceGroupName"

            Write-Verbose -Verbose "Machine $name status:"
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

function Create-AzureResourceGroupIfNotExist
{
    param([string]$resourceGroupName,
    [string]$location)

    $azureResourceGroup = Get-AzureResourceGroup -ResourceGroupName $resourceGroupName -ErrorAction silentlycontinue

    if(!$azureResourceGroup)
    {
        Write-Verbose -Verbose "[Azure Resource Manager]Creating resource group $resourceGroupName in $location"

        $response = New-AzureResourceGroup -Name $resourceGroupName -Location $location -Verbose -ErrorAction Stop

        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Created resource group '{0}'" -ArgumentList $resourceGroupName)
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

function Get-AzureMachinesInResourceGroup
{
    param([string]$resourceGroupName)

    Write-Verbose -Verbose "[Azure Resource Manager]Getting resource group:$resourceGroupName virtual machines type resources"
    $azureResourceGroupVMResources = Get-AzureResource -ResourceType "Microsoft.Compute/virtualMachines" -ResourceGroupName $resourceGroupName -ErrorAction Stop
    Write-Verbose -Verbose "[Azure Resource Manager]Got resource group:$resourceGroupName virtual machines type resources"

    return $azureResourceGroupVMResources
}

function Delete-MachineGroupFromProvider
{
    param([string]$machineGroupName)

    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleting resource group {0}" -ArgumentList $machineGroupName)

    Remove-AzureResourceGroup -ResourceGroupName $machineGroupName -Force -ErrorAction Stop -Verbose
    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted resource group '{0}' from Azure provider" -ArgumentList $machineGroupName)
}

function Delete-MachineFromProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    $errorVariable=@()
    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleting machine '{0}'" -ArgumentList $machineName)
    $removeResponse = Remove-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -Force -ErrorAction SilentlyContinue -ErrorVariable errorVariable -Verbose

    if($errorVariable.Count -eq 0)
    {
         Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted machine '{0}' from Azure provider" -ArgumentList $machineName)
         return "Succeeded"
    }
    else
    {
         Write-Warning(Get-LocalizedString -Key "[Azure Resource Manager]Deletion of machine '{0}' failed in Azure with error '{1}'" -ArgumentList $machineName, $errorVariable)
         return "Failed"
    }
}

function Start-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    $errorVariable=@()
    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Starting machine '{0}'" -ArgumentList $machineName)

    Start-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -ErrorVariable errorVariable | Out-Null

    return $errorVariable
}

function Stop-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    $errorVariable=@()
    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Stopping machine '{0}'" -ArgumentList $machineName)

    Stop-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -ErrorVariable errorVariable -Force | Out-Null

    return $errorVariable
}

function Restart-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    $errorVariable=@()
    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Restarting machine '{0}'" -ArgumentList $machineName)

    Restart-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -ErrorVariable errorVariable | Out-Null

    return $errorVariable
}