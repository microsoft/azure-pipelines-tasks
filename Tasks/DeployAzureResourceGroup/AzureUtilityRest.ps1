function Create-AzureResourceGroupIfNotExist
{
    param([string]$resourceGroupName,
          [string]$location,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        try
        {
            Write-Verbose "[Azure Resource Manager]Getting resource group:$resourceGroupName"
            $azureResourceGroup = Get-AzRmResourceGroup $resourceGroupName $endpoint -ErrorAction silentlyContinue
            Write-Verbose "[Azure Resource Manager]Got resource group:$resourceGroupName"
        }
        catch
        {
            #Ignoring the exception
        }

        if(-not $azureResourceGroup -and -not [string]::IsNullOrEmpty($location))
        {
            Write-Verbose "[Azure Resource Manager]Creating resource group $resourceGroupName in $location"
            $azureResourceGroup = New-AzureRMResourceGroup -Name $resourceGroupName -Location $location -Verbose -ErrorAction Stop
            Write-Host (Get-VstsLocString -Key "ARG_CreatedResourceGroup" -ArgumentList $resourceGroupName)
        }
        return $azureResourceGroup
    }
}

function Get-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
    {
        Write-Host (Get-VstsLocString -Key "ARG_GettingExtensionStatus" -ArgumentList $name, $vmName)
        $customScriptExtension = Get-AzRmVmCustomScriptExtension $resourceGroupName $vmName $name $endpoint -ErrorAction Stop -Verbose     
        Write-Host (Get-VstsLocString -Key "ARG_GotExtensionStatus" -ArgumentList $name, $vmName)
    }
	
    return $customScriptExtension
}

function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-VstsLocString -Key "ARG_RemovingExtension" -ArgumentList $name, $vmName)
        $response = Remove-AzRmVMCustomScriptExtension $resourceGroupName $vmName $name $endpoint -Force -ErrorAction SilentlyContinue -Verbose		
        Write-Host (Get-VstsLocString -Key "ARG_RemovedExtension" -ArgumentList $name, $vmName)
    }

    return $response
}