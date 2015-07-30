param (
    [string]$environmentName,
    [string]$resourceFilteringMethod,
    [string]$machineNames,
    [string]$sourcePath,
    [string]$targetPath,
    [string]$cleanTargetBeforeCopy,
    [string]$copyFilesInParallel
    )

Write-Verbose "Entering script WindowsMachineFileCopy.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose

. ./WindowsMachineFileCopyJob.ps1
. ./WindowsMachineFileCopyHelper.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

# keep machineNames parameter name unchanged due to back compatibility
$machineFilter = $machineNames

# Default + constants #
$defaultWinRMPort = '5985'
$defaultSkipCACheckOption = ''
$defaultHttpProtocolOption = '-UseHttp' # For on-prem BDT only HTTP support enabled , use this as default until https support is not enabled 
$resourceFQDNKeyName = 'Microsoft-Vslabs-MG-Resource-FQDN'
$resourceWinRMHttpPortKeyName = 'WinRM_Http'
$doSkipCACheckOption = '-SkipCACheck'
$envOperationStatus = 'Passed'

function ThrowError
{
	param([string]$errorMessage)
	
        $readmelink = "https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/WindowsMachineFileCopy/README.md"
        $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
        throw "$errorMessage $helpMessage"
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

function Get-ResourceConnectionDetails
{
    param([object]$resource)
	
	$resourceProperties = @{}
	
	$resourceName = $resource.Name
	
    Write-Verbose "`t`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceFQDNKeyName" -Verbose
	$fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
    Write-Verbose "`t`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceFQDNKeyName" -Verbose
	
	Write-Verbose "`t`t Resource fqdn - $fqdn" -Verbose	
		
	$resourceProperties.fqdn = $fqdn
	
	$resourceProperties.httpProtocolOption = $defaultHttpProtocolOption
	
	Write-Verbose "`t`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpPortKeyName" -Verbose
	$winrmPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceName $resourceName -ErrorAction Stop
	Write-Verbose "`t`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource name: $resourceName and key: $resourceWinRMHttpPortKeyName" -Verbose
	
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

function Get-WellFormedTagsList
{
    [CmdletBinding()]
    Param
    (
        [string]$tagsListString
    )

    if([string]::IsNullOrWhiteSpace($tagsListString))
    {
        return $null
    }

    $tagsArray = $tagsListString.Split(';')
    $tagList = New-Object 'System.Collections.Generic.List[Tuple[string,string]]'
    foreach($tag in $tagsArray)
    {
        if([string]::IsNullOrWhiteSpace($tag)) {continue}
        $tagKeyValue = $tag.Split(':')
        if($tagKeyValue.Length -ne 2)
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        if([string]::IsNullOrWhiteSpace($tagKeyValue[0]) -or [string]::IsNullOrWhiteSpace($tagKeyValue[1]))
        {
            throw (Get-LocalizedString -Key 'Please have the tags in this format Role:Web,Db;Tag2:TagValue2;Tag3:TagValue3')
        }

        $tagTuple = New-Object "System.Tuple[string,string]" ($tagKeyValue[0].Trim(), $tagKeyValue[1].Trim())
        $tagList.Add($tagTuple) | Out-Null
    }

    $tagList = [System.Collections.Generic.IEnumerable[Tuple[string,string]]]$tagList
    return ,$tagList
}

$connection = Get-VssConnection -TaskContext $distributedTaskContext

if($resourceFilteringMethod -eq "tags")
{
    $wellFormedTagsList = Get-WellFormedTagsList -tagsListString $machineFilter

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with tag filter: $wellFormedTagsList" -Verbose
    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -TagFilter $wellFormedTagsList -Connection $connection
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with tag filter" -Verbose
}
else
{
    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with machine filter: $machineFilter" -Verbose
    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineFilter -Connection $connection
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with machine filter" -Verbose
}

Write-Verbose "Starting Invoke-EnvironmentOperation cmdlet call on environment name: $environmentName with operation name: Copy Files" -Verbose
$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Copy Files" -Connection $connection -ErrorAction Stop
Write-Verbose "Completed Invoke-EnvironmentOperation cmdlet call on environment name: $environmentName with operation name: Copy Files" -Verbose

Write-Verbose "envOperationId = $envOperationId" -Verbose

$resourcesPropertyBag = Get-ResourcesProperties -resources $resources

if($copyFilesInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach($resource in $resources)
    {		
		$resourceProperties = $resourcesPropertyBag.Item($resource.Name)
		
        $machine = $resourceProperties.fqdn
		
        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $machine)

		Write-Verbose "Starting Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $machine and environment operationId: $envOperationId" -Verbose
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		Write-Verbose "Completed Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $machine and environment operationId: $envOperationId" -Verbose

		Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
		
        $copyResponse = Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption
       
        $status = $copyResponse.Status
        Output-ResponseLogs -operationName "copy" -fqdn $machine -deploymentResponse $copyResponse
        
        Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)
		
		Write-Verbose "Do complete ResourceOperation for  - $machine" -Verbose
		
		DoComplete-ResourceOperation -environmentName $environmentName -envOperationId $envOperationId -resOperationId $resOperationId -connection $connection -deploymentResponse $copyResponse

        if($status -ne "Passed")
        {
			Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: Failed" -Verbose
            Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection -ErrorAction Stop
			Write-Verbose "Completed Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: Failed" -Verbose

			Write-Verbose $copyResponse.Error.ToString() -Verbose
            $errorMessage =  $copyResponse.Error.Message
            ThrowError -errorMessage $errorMessage
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
		
		Write-Verbose "Starting Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $machine and environment operationId: $envOperationId" -Verbose
		$resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $machine -EnvironmentOperationId $envOperationId -Connection $connection -ErrorAction Stop
		Write-Verbose "Completed Invoke-ResourceOperation cmdlet call on environment name: $environmentName with resource name: $machine and environment operationId: $envOperationId" -Verbose

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
				 
				 $machineName = $Jobs.Item($job.Id).fqdn
				 $resOperationId = $Jobs.Item($job.Id).resOperationId

                 Output-ResponseLogs -operationName "copy" -fqdn $machineName -deploymentResponse $output
				 
                 Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machineName, $status)

                 if($status -ne "Passed")
                 {
                    $envOperationStatus = "Failed"
                    $errorMessage = ""
                    if($output.Error -ne $null)
                    {
                        $errorMessage = $output.Error.Message
                    }
                    Write-Output (Get-LocalizedString -Key "Copy failed on machine '{0}' with following message : '{1}'" -ArgumentList $machineName, $errorMessage)
                 }
				 
				 DoComplete-ResourceOperation -environmentName $environmentName -envOperationId $envOperationId -resOperationId $resOperationId -connection $connection -deploymentResponse $output
              } 
        }
    }
}

Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose
Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop
Write-Verbose "Completed Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose

if($envOperationStatus -ne "Passed")
{
    $errorMessage = (Get-LocalizedString -Key 'Copy to one or more machines failed.')
    ThrowError -errorMessage $errorMessage
}

Write-Verbose "Leaving script WindowsMachineFileCopy.ps1" -Verbose
