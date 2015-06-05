param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$scriptPath,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [string]$runPowershellInParallel
    )

Write-Verbose "Entering script PowerShellOnTargetMachines.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "scriptArguments = $scriptArguments" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose
Write-Verbose "runPowershellInParallel = $runPowershellInParallel" -Verbose

. ./PowerShellJob.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

# Getting resource tag key name for corresponding tag
$resourceFQDNKeyName = Get-ResourceFQDNTagKey
$resourceWinRMHttpPortKeyName = Get-ResourceHttpTagKey
$resourceWinRMHttpsPortKeyName = Get-ResourceHttpsTagKey

# Constants #
$useHttpProtocolOption = '-UseHttp'
$useHttpsProtocolOption = ''

$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''

$envOperationStatus = "Passed"


function Get-ResourceWinRmConfig
{
	param([string]$resourceName)

	$resourceProperties = @{}
		
	$winrmPortToUse = ''
    $protocolToUse = ''
    # check whether https port is defined for resource
    $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceName $resourceName
    if ([string]::IsNullOrEmpty($winrmHttpsPort))
    {
        Write-Verbose "`t Resource: $resourceName does not have any winrm https port defined, checking for winrm http port" -Verbose
        $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName

        # if resource does not have any port defined then, use https port by default
        if ([string]::IsNullOrEmpty($winrmHttpPort))
        {
            throw("`t Resource: $resourceName does not have any winrm http or https port defined, failing the operation")
        }
        else
        {
            # if resource has winrm http port defined
            $winrmPortToUse = $winrmHttpPort
            $protocolToUse = $useHttpProtocolOption
        }
    }
    else
    {
        # if resource has winrm https port opened
        $winrmPortToUse = $winrmHttpsPort
        $protocolToUse = $useHttpsProtocolOption
    }

	$resourceProperties.protocolOption = $protocolToUse
	$resourceProperties.winrmPort = $winrmPortToUse

	return $resourceProperties;

}

function Get-SkipCACheckOption
{
	[CmdletBinding()]
    Param
	(
		[string]$environmentName,
        [Microsoft.VisualStudio.Services.Client.VssConnection]$connection
	)

	$doSkipCACheckOption = '-SkipCACheck'
	$doNotSkipCACheckOption = ''
    $skipCACheckOption = $doSkipCACheckOption

	$skipCACheckKeyName = Get-SkipCACheckTagKey

    # get skipCACheck option from environment
    $skipCACheckBool = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $skipCACheckKeyName -Connection $connection

    if ($skipCACheckBool -eq "false")
    {
        $skipCACheckOption = $doNotSkipCACheckOption
    }

    return $skipCACheckOption
}

function Get-ResourceConnectionDetails
{
    param([object]$resource)
	
	$resourceProperties = @{}
	$resourceName = $resource.Name 
	
	$fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop	
	$winrmconfig = Get-ResourceWinRmConfig -resourceName $resourceName
			
	$resourceProperties.fqdn = $fqdn
	$resourceProperties.winrmPort = $winrmconfig.winrmPort
	$resourceProperties.protocolOption = $winrmconfig.protocolOption
	$resourceProperties.credential = Get-ResourceCredentials -resource $resource	
		
	return $resourceProperties
}

function Get-ResourcesProperties
{
	param([object]$resources)

	$skipCACheckOption = Get-SkipCACheckOption -environmentName $environmentName -connection $connection
	
	[hashtable]$resourcesPropertyBag = @{}
	
	foreach ($resource in $resources)
    {
		$resourceName = $resource.Name
		
		Write-Verbose "Get Resource properties for $resourceName " -Verbose			
		
		# Get other connection details for resource like - fqdn, wirmport, http protocol, resource credentials

		$resourceProperties = Get-ResourceConnectionDetails -resource $resource
		$resourceProperties.skipCACheckOption = $skipCACheckOption
		
		$resourcesPropertyBag.add($resourceName, $resourceProperties)
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
		
		Write-Output (Get-LocalizedString -Key "Deployment started for - '{0}'" -ArgumentList $machine)
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
        $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption
		
        Write-ResponseLogs -operationName "deployment" -fqdn $machine -deploymentResponse $deploymentResponse

        $status = $deploymentResponse.Status

        Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)
		
		Write-Verbose "Do complete ResourceOperation for  - $machine" -Verbose
		
		$logs = Get-ResourceOperationLogs -deploymentResponse $deploymentResponse		
		Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $deploymentResponse.Status -ErrorMessage $deploymentResponse.Error -Logs $logs -Connection $connection

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
		
        Write-Output (Get-LocalizedString -Key "Deployment started for - '{0}'" -ArgumentList $machine)
		
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		
		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
		$resourceProperties.resOperationId = $resOperationId
		
        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $machine, $scriptPath, $resourceProperties.winrmPort, $scriptArguments, $initializationScriptPath, $resourceProperties.credential, $resourceProperties.protocolOption, $resourceProperties.skipCACheckOption

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
				 
				 Write-ResponseLogs -operationName "Deployment" -fqdn $machineName -deploymentResponse $output
				 
                 Write-Output (Get-LocalizedString -Key "Deployment status for machine '{0}' : '{1}'" -ArgumentList $machineName, $status)
				 
				 Write-Verbose "Do complete ResourceOperation for  - $machine" -Verbose
				 
				 $logs = Get-ResourceOperationLogs -deploymentResponse $output		
				 Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $output.Status -ErrorMessage $output.Error -Logs $logs -Connection $connection
                 
              } 
        }
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop

if($envOperationStatus -ne "Passed")
{
    throw (Get-LocalizedString -Key 'Deployment on one or more machines failed')
}

Write-Verbose "Leaving script PowerShellOnTargetMachines.ps1" -Verbose
