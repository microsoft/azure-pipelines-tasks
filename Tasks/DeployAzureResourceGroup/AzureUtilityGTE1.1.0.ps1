# This file implements IAzureUtility for Azure PowerShell version >= 1.1.0

Import-Module ./AzureUtilityGTE1.0.ps1 -Force

function Start-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($machineName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Starting machine '{0}'" -ArgumentList $machineName)
        $response = Start-AzureRMVM -Name $machineName -ResourceGroupName $resourceGroupName -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Started machine '{0}' from Azure provider" -ArgumentList $machineName)
        if($response.IsSuccessStatusCode -eq $true)
        {
            $responseJObject = [Newtonsoft.Json.Linq.JObject]::Parse(($response | ConvertTo-Json))
            $response = $responseJObject.ToObject([System.Collections.Hashtable])
            $response.Status = "Succeeded"
        }
    }
    return $response
}

function Stop-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($machineName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Stopping machine '{0}'" -ArgumentList $machineName)
        $response = Stop-AzureRMVM -Name $machineName -ResourceGroupName $resourceGroupName -Force -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Stopped machine '{0}' from Azure provider" -ArgumentList $machineName)
        if($response.IsSuccessStatusCode -eq $true)
        {
            $responseJObject = [Newtonsoft.Json.Linq.JObject]::Parse(($response | ConvertTo-Json))
            $response = $responseJObject.ToObject([System.Collections.Hashtable])
            $response.Status = "Succeeded"
        }
    }
    return $response
}

function Delete-Machine
{
    param([string]$resourceGroupName,
          [string]$machineName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($machineName))
    {
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleting machine '{0}'" -ArgumentList $machineName)
        $response = Remove-AzureRMVM -Name $machineName -ResourceGroupName $resourceGroupName -Force -ErrorAction Stop -Verbose
        Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted machine '{0}' from Azure provider" -ArgumentList $machineName)
        if($response.IsSuccessStatusCode -eq $true)
        {
            $responseJObject = [Newtonsoft.Json.Linq.JObject]::Parse(($response | ConvertTo-Json))
            $response = $responseJObject.ToObject([System.Collections.Hashtable])
            $response.Status = "Succeeded"
        }
    }
    return $response
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
        Write-Host (Get-LocalizedString -Key "[Azure Call]Setting the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        Write-Verbose -Verbose "Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose"
        $result = Set-AzureRmVMCustomScriptExtension -ResourceGroupName $resourceGroupName -VMName $vmName -Name $name -FileUri $fileUri  -Run $run -Argument $argument -Location $location -ErrorAction Stop -Verbose		
        Write-Host (Get-LocalizedString -Key "[Azure Call]Set the custom script extension '{0}' for vm '{1}'" -ArgumentList $name, $vmName)
        if($result.IsSuccessStatusCode -eq $true)
        {
            $responseJObject = [Newtonsoft.Json.Linq.JObject]::Parse(($result | ConvertTo-Json))
            $result = $responseJObject.ToObject([System.Collections.Hashtable])
            $result.Status = "Succeeded"
        }
    }
    return $result
}