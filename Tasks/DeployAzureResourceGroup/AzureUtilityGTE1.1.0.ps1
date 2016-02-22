# This file implements IAzureUtility for Azure PowerShell version >= 1.1.0

Import-Module ./AzureUtilityGTE1.0.ps1 -Force

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
		#TODO: Till AzurePS 1.2.1, for failure case there is no change in response object structure. When ever that change will happen we have to consider the case when
        # 	$result.IsSuccessStatusCode -eq $false and set Status and Error filed in $result.	
    }

    return $result
}
