param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$scriptPath,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [string]$runPowershellInParallel,
	[string]$connectionProtocol,
	[string]$security
    )

Write-Verbose "Entering script RunPowerShellOnTargetMachines.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "scriptArguments = $scriptArguments" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose
Write-Verbose "runPowershellInParallel = $runPowershellInParallel" -Verbose
Write-Verbose "Connection Protocol = $connectionProtocol" -Verbose
Write-Verbose "Security Option = $security" -Verbose


. ./RunPowerShellHelper.ps1
. ./RunPowerShellJob.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

	# Constants #
$resourceFQDNKeyName = 'Microsoft-Vslabs-MG-Resource-FQDN'
$resourceWinRMHttpPortKeyName = 'WinRM_HttpPort'
$resourceWinRMHttpsPortKeyName = 'WinRM_HttpsPort'
$httpConnectionProtocolValue = 'http'
$httpsConnectionProtocolValue = 'https'
$skipCACheckOptionValue = 'doSkipCAchek'


	# Defaults #
$envOperationStatus = "Passed"
$defaultWinRMHttpPort = '5985'
$defaultWinRMHttpsPort = '5986'
$useHttpProtocol = $true
$httpProtocolOption = '-UseHttp'
$doSkipCACheckOption = '-SkipCACheck'

	# Process input parameters #
if($connectionProtocol -eq $httpsConnectionProtocolValue)
{
	$useHttpProtocol = $false	# use https connection
	$httpProtocolOption = ''
	
	# check if certificate authentication is opted for https connection
	if($security -ne $skipCACheckOptionValue )
	{
		$doSkipCACheckOption = ''
		Write-Verbose "Certificate authentication will be used to connect to target machines for given winrm https port" -Verbose
	}
	else
	{
		Write-Verbose "Certificate authentication is not opted to connect to target machines for given winrm https port" -Verbose
	}
}

function Get-ResourceCredentials
{
	param([object]$resource)
	
	$machineUserName = $resource.Username
	
	Write-Verbose "`t`t Resource Username - $machineUserName" -Verbose

	$machinePassword = $resource.Password

	$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword
	
	return $credential
}

function Get-WinRMPort
{
	param([string]$resourceName)
	
	if($useHttpProtocol)
		{
			$winrmPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
			if([string]::IsNullOrEmpty($winrmPort))
			{
				$winrmPort = $defaultWinRMHttpPort
				Write-Verbose "`t`t Resource $resourceName does not have any $resourceWinRMHttpPortKeyName defined , use the default - $defaultWinRMHttpPort for deployment" -Verbose			
			}
			else
			{
				Write-Verbose "`t`t Resource $resourceName has $resourceWinRMHttpPortKeyName defined as - $winrmPort" -Verbose			
			}
		}
		else
		{
			$winrmPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
			if([string]::IsNullOrEmpty($winrmPort))
			{
				$winrmPort = $defaultWinRMHttpsPort
				Write-Verbose "`t`t Resource $resourceName does not have any $resourceWinRMHttpsPortKeyName defined , use the default - $defaultWinRMHttpsPort for deployment" -Verbose		
			}
			else
			{	
				Write-Verbose "`t`t Resource $resourceName has $resourceWinRMHttpsPortKeyName defined as - $winrmPort" -Verbose	
			}
		}
		
	return $winrmPort
}

function Get-ResourcesProperties
{
	param([object]$resources)
	
	$resourcesProperties = @()
	
	foreach ($resource in $resources)
    {
		[hashtable]$eachResourceProperties = @{} 
		
		$resourceName = $resource.Name
		
		Write-Verbose "Get Resource properties for $resourceName " -Verbose			
		
		$fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
		
		Write-Verbose "`t`t Resource fqdn - $fqdn" -Verbose
		
		$eachResourceProperties.fqdn = $fqdn
		
		$winrmPort = Get-WinRMPort -resourceName $resourceName
		
		Write-Verbose "`t`t Resource winrmPort - $winrmPort" -Verbose
		
		$eachResourceProperties.winrmPort = $winrmPort
		
		$eachResourceProperties.credential = Get-ResourceCredentials -resource $resource

		$resourcesProperties += $eachResourceProperties
	}
	
	return $resourcesProperties
}

$connection = Get-VssConnection -TaskContext $distributedTaskContext

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection -ErrorAction Stop

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Deployment" -Connection $connection -ErrorAction Stop

Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose

$resourcesProperties = Get-ResourcesProperties -resources $resources

if($runPowershellInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach ($resource in $resourcesProperties)
    {    	
        $machine = $resource.fqdn
		
		Write-Output "Deployment Started for - $machine"
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
        $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resource.winrmPort, $scriptArguments, $initializationScriptPath, $resource.credential, $httpProtocolOption, $doSkipCACheckOption
		
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

    foreach ($resource in $resourcesProperties)
    {       		
        $machine = $resource.fqdn
		
		Write-Output "Deployment Started for - $machine"
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
		[hashtable]$resourceMetadata = @{} 
		$resourceMetadata.machineName = $machine
		$resourceMetadata.resOperationId = $resOperationId
		
        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resource.winrmPort, $scriptArguments, $initializationScriptPath, $resource.credential, $httpProtocolOption, $doSkipCACheckOption

        $Jobs.Add($job.Id, $resourceMetadata)
         
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
            
                 $machineName = $Jobs.Item($job.Id).machineName
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