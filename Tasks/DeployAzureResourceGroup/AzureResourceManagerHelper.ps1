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
    try
    {
        Write-Verbose -Verbose "[Azure Resource Manager]Getting resource group:$resourceGroupName virtual machines type resources"
        $azureResourceGroupVMResources = Get-AzureResource -ResourceType "Microsoft.Compute/virtualMachines" -ResourceGroupName $resourceGroupName -ErrorAction Stop
        Write-Verbose -Verbose "[Azure Resource Manager]Got resource group:$resourceGroupName virtual machines type resources"
    }
    catch [Microsoft.Azure.Commands.ResourceManager.Cmdlets.Entities.ErrorResponses.ErrorResponseMessageException]
    {
        Write-Error $_.Exception.ErrorResponseMessage.Error.Message -Verbose
    }
    catch
    {
        Write-Error $_.Exception.Message -Verbose
    }

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