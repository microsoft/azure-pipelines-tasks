param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$sourcePath,
    [string]$targetPath,
    [string]$cleanTargetBeforeCopy,
    [string]$deployFilesInParallel
    )

Write-Verbose "Entering script WindowsMachineFileCopy.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "deployFilesInParallel = $deployFilesInParallel" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose

. ./WindowsMachineFileCopyJob.ps1
. ./WindowsMachineFileCopyHelper.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

# Default + constants #
$defaultWinRMPort = '5985'
$defaultSkipCACheckOption = ''	
$defaultHttpProtocolOption = '-UseHttp' # For on-prem BDT only HTTP support enabled , use this as default until https support is not enabled 
$resourceFQDNKeyName = 'Microsoft-Vslabs-MG-Resource-FQDN'
$resourceWinRMHttpPortKeyName = 'WinRM_Http'
$doSkipCACheckOption = '-SkipCACheck'
$envOperationStatus = 'Passed'


function Get-ResourceCredentials
{
	param([object]$resource)
		
	$machineUserName = $resource.Username
	Write-Verbose "`t`t Resource Username - $machineUserName" -Verbose
	$machinePassword = $resource.Password

	$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword
	
	return $credential
}

function Get-ResourceConnectionDetails
{
    param([object]$resource)
	
	$resourceProperties = @{}
	
	$resourceName = $resource.Name
	
	$fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
		
	Write-Verbose "`t`t Resource fqdn - $fqdn" -Verbose	
		
	$resourceProperties.fqdn = $fqdn
	
	$resourceProperties.httpProtocolOption = $defaultHttpProtocolOption
	
	$winrmPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
		
	if([string]::IsNullOrEmpty($winrmPort))
	{
		Write-Verbose "`t`t Resource $resourceName does not have any winrm port defined , use the default - $defaultWinRMPort" -Verbose
		$winrmPort = $defaultWinrmPort	
	}
	else
	{
		Write-Verbose "`t`t Resource $resourceName has winrm http port $winrmPort defined " -Verbose
	}
	
	$resourceProperties.credential = Get-ResourceCredentials -resource $resource
	
	$resourceProperties.winrmPort = $winrmPort
	
	if($resourceProperties.httpProtocolOption -eq $defaultHttpProtocolOption)
	{
		$resourceProperties.skipCACheckOption = $doSkipCACheckOption	# If http option is opted , skip the CA check
	}
	
	return $resourceProperties
}

function Get-ResourcesProperties
{
    param([object]$resources)

	[hashtable]$resourcesPropertyBag = @{}
	
	foreach ($resource in $resources)
    {
		$resourceName = $resource.Name
		Write-Verbose "Get Resource properties for $resourceName" -Verbose		
		
		# Get other connection details for resource like - fqdn wirmport, http protocol, skipCACheckOption, resource credentials

		$resourceProperties = Get-ResourceConnectionDetails -resource $resource
		
		$resourcesPropertyBag.Add($resourceName, $resourceProperties)
	}
	 return $resourcesPropertyBag
}


$connection = Get-VssConnection -TaskContext $distributedTaskContext

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection -ErrorAction Stop

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Copy Files" -Connection $connection -ErrorAction Stop

Write-Verbose "envOperationId = $envOperationId" -Verbose

$resourcesPropertyBag = Get-ResourcesProperties -resources $resources

if($deployFilesInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach($resource in $resources)
    {		
		$resourceProperties = $resourcesPropertyBag.Item($resource.Name)
		
        $machine = $resourceProperties.fqdn
		
        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $machine)

		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
        $copyResponse = Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption
       
        $status = $copyResponse.Status
        Output-ResponseLogs -operationName "copy" -fqdn $machine -deploymentResponse $copyResponse
        
        Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)
		
		Write-Verbose "Do complete ResourceOperation for  - $machine" -Verbose
		
		DoComplete-ResourceOperation -environmentName $environmentName -envOperationId $envOperationId -resOperationId $resOperationId -connection $connection -deploymentResponse $copyResponse

        if($status -ne "Passed")
        {
            Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection -ErrorAction Stop

            throw $copyResponse.Error
        }
    } 
}

else
{
    [hashtable]$Jobs = @{} 

    foreach($resource in $resources)
    {
		$resourceProperties = $resourcesPropertyBag.Item($resource.Name)
		
        $machine = $resourceProperties.fqdn
		
        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $machine)
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
		$resourceProperties.resOperationId = $resOperationId

        $job = Start-Job -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption

        $Jobs.Add($job.Id, $resourceProperties)
    }

    While (Get-Job)
    {
         Start-Sleep 10 
         foreach($job in Get-Job)
         {
             if($job.State -ne "Running")
             {
                 $output = Receive-Job -Id $job.Id
                 Remove-Job $Job
                 $status = $output.Status

                 if($status -ne "Passed")
                 {
                     $envOperationStatus = "Failed"
                 }
				 
				 $machineName = $Jobs.Item($job.Id).fqdn
				 $resOperationId = $Jobs.Item($job.Id).resOperationId

                 Output-ResponseLogs -operationName "copy" -fqdn $machineName -deploymentResponse $output
				 
                 Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machineName, $status)
				 
				 DoComplete-ResourceOperation -environmentName $environmentName -envOperationId $envOperationId -resOperationId $resOperationId -connection $connection -deploymentResponse $output
              } 
        }
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop

if($envOperationStatus -ne "Passed")
{
    throw (Get-LocalizedString -Key 'Copy to one or more machines failed')
}

Write-Verbose "Leaving script WindowsMachineFileCopy.ps1" -Verbose
