# This file implements IAzureUtility for Azure PowerShell version >= 1.1.0

. "$PSScriptRoot/AzureUtilityGTE1.0.ps1"

function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)

    If(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        try
        {
            Write-Verbose "[Azure Call]Getting resource group:$resourceGroupName RM virtual machines type resources"
            $azureRMVMResources = Get-AzureRMVM -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
            Write-Verbose "[Azure Call]Count of resource group:$resourceGroupName RM virtual machines type resource is $($azureRMVMResources.Count)"

            return $azureRMVMResources
        }
        catch [Hyak.Common.CloudException], [Microsoft.Rest.Azure.CloudException]
        {
            $exceptionMessage = $_.Exception.Message.ToString()
            Write-Verbose "ExceptionMessage: $exceptionMessage"

            Write-Telemetry "Task_InternalError" "ResourceGroupNotFound"
            throw (Get-VstsLocString -Key "AFC_ResourceGroupNotFound" -ArgumentList $resourceGroupName)
        }
    }
}

function Set-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [string[]]$fileUri,
          [string]$run,
          [string]$argument,
          [string]$location)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        Write-Host (Get-VstsLocString -Key "AFC_SetCustomScriptExtension" -ArgumentList $name, $vmName)
        Write-Verbose "Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose"
        $result = Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose		
        Write-Host (Get-VstsLocString -Key "AFC_SetCustomScriptExtensionComplete" -ArgumentList $name, $vmName)
        if($result.IsSuccessStatusCode -eq $true)
        {
            $responseJObject = [Newtonsoft.Json.Linq.JObject]::Parse(($result | ConvertTo-Json))
            $result = $responseJObject.ToObject([System.Collections.Hashtable])
            $result.Status = "Succeeded"
        }
        #TODO: Till AzurePS 1.2.1, for failure case there is no change in response object structure. When ever that change will happen we have to consider the case when
        # 	$result.IsSuccessStatusCode -eq $false and set Status and Error filed in $result.	
    }

    return $result
}
