param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$scriptPath,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [string]$runPowershellInParallel
    )

Write-Verbose "Entering script RunPowerShellOnTargetMachines.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "scriptArguments = $scriptArguments" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose
Write-Verbose "runPowershellInParallel = $runPowershellInParallel" -Verbose

. ./RunPowerShellHelper.ps1
. ./RunPowerShellJob.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

	# Constants +  Defaults #
$resourceFQDNKeyName = 'Microsoft-Vslabs-MG-Resource-FQDN'
$resourceWinRMHttpPortKeyName = 'WinRM_HttpPort'
$defaultWinRMHttpPort = '5985'
$defaultHttpProtocolOption = '-UseHttp' # For on-prem BDT only HTTP support enabled , use this as default until https support is not enabled 
$defaultSkipCACheckOption = ''	
$doSkipCACheckOption = '-SkipCACheck'
$envOperationStatus = "Passed"

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
		Write-Verbose "`t`t Resource $resourceName does not have any winrm port defined , use the default - $defaultWinRMHttpPort" -Verbose
		$winrmPort = $defaultWinRMHttpPort	
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
		
		Write-Verbose "Get Resource properties for $resourceName " -Verbose			
		
		# Get other connection details for resource like - fqdn, wirmport, http protocol, skipCACheckOption, resource credentials

		$resourceProperties = Get-ResourceConnectionDetails -resource $resource
		
		$resourcesPropertyBag.add($resourceName,$resourceProperties)
	}
	
	return $resourcesPropertyBag
}

$connection = Get-VssConnection -TaskContext $distributedTaskContext

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection -ErrorAction Stop

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Deployment" -Connection $connection -ErrorAction Stop
Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose

$resourcesPropertyBag = Get-ResourcesProperties -resources $resources

if($runPowershellInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach($resource in $resources)
    {
		$resourceProperties = $resourcesPropertyBag.Item($resource.Name)
		
        $machine = $resourceProperties.fqdn
		
		Write-Output "Deployment Started for - $machine"
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
        $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption
		
        Output-ResponseLogs -operationName "deployment" -fqdn $machine -deploymentResponse $deploymentResponse

        $status = $deploymentResponse.Status

        Write-Output "Deployment Status for machine $machine : $status"
		
		Write-Verbose "Do complete ResourceOperation for  - $machine" -Verbose
		
		DoComplete-ResourceOperation -environmentName $environmentName -envOperationId $envOperationId -resOperationId $resOperationId -connection $connection -deploymentResponse $deploymentResponse

        if ($status -ne "Passed")
        {
            Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection -ErrorAction Stop

            throw $deploymentResponse.Error;
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
		
		Write-Output "Deployment Started for - $machine"
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
		$resourceProperties.resOperationId = $resOperationId
		
        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption

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
				 
				 Output-ResponseLogs -operationName "Deployment" -fqdn $machineName -deploymentResponse $output
				 
                 Write-Output "Deployment Status for machine $machineName : $status"
				 
				 Write-Verbose "Do complete ResourceOperation for  - $machine" -Verbose
				 
				 DoComplete-ResourceOperation -environmentName $environmentName -envOperationId $envOperationId -resOperationId $resOperationId -connection $connection -deploymentResponse $output
                 
              } 
        }
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop

if($envOperationStatus -ne "Passed")
{
    throw "deployment on one or more machine failed."
}

Write-Verbose "Leaving script RunPowerShellOnTargetMachines.ps1" -Verbose