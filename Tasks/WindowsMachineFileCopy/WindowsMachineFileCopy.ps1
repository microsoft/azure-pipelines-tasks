param (
    [string]$environmentName,
    [string]$adminUserName,
    [string]$adminPassword,
    [string]$resourceFilteringMethod,
    [string]$machineNames,
    [string]$sourcePath,
    [string]$targetPath,
    [string]$additionalArguments,
    [string]$cleanTargetBeforeCopy,
    [string]$copyFilesInParallel
    )

Write-Verbose "Entering script WindowsMachineFileCopy.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "adminUserName = $adminUserName" -Verbose
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "copyFilesInParallel = $copyFilesInParallel" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose

. ./WindowsMachineFileCopyJob.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

# keep machineNames parameter name unchanged due to back compatibility
$machineFilter = $machineNames
$sourcePath = $sourcePath.Trim('"')
$targetPath = $targetPath.Trim('"')

# Default + constants #
$resourceFQDNKeyName = Get-ResourceFQDNTagKey

$envOperationStatus = 'Passed'

function ThrowError
{
    param([string]$errorMessage)
    
        $readmelink = "http://aka.ms/windowsfilecopyreadme"
        $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
        throw "$errorMessage $helpMessage"
}

function Get-ResourceConnectionDetails
{
    param([object]$resource)

    $resourceProperties = @{}

    $resourceName = $resource.Name
    $resourceId = $resource.Id

    Write-Verbose "`t`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose
    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -TaskContext $distributedTaskContext -ResourceId $resourceId -ErrorAction Stop
    Write-Verbose "`t`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose

    Write-Verbose "`t`t Resource fqdn - $fqdn" -Verbose	

    $resourceProperties.fqdn = $fqdn
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource    

    return $resourceProperties
}

function Get-ResourcesProperties
{
    param([object]$resources)    

    [hashtable]$resourcesPropertyBag = @{}

    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        $resourceId = $resource.Id
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)" -Verbose		

        # Get other connection details for resource like - fqdn wirmport, http protocol, skipCACheckOption, resource credentials

        $resourceProperties = Get-ResourceConnectionDetails -resource $resource        
        
        $resourcesPropertyBag.Add($resourceId, $resourceProperties)
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

Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName" -Verbose
$environment = Register-Environment -EnvironmentName $environmentName -MachineList $environmentName -UserName $adminUserName -Password $adminPassword -Connection $connection -TaskContext $distributedTaskContext
Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName" -Verbose

if($resourceFilteringMethod -eq "tags")
{
    $wellFormedTagsList = Get-WellFormedTagsList -tagsListString $machineFilter

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with tag filter: $wellFormedTagsList" -Verbose
    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -TagFilter $wellFormedTagsList -TaskContext $distributedTaskContext
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with tag filter" -Verbose
}
else
{
    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $environmentName with machine filter: $machineFilter" -Verbose
    $resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineFilter -TaskContext $distributedTaskContext
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $environmentName with machine filter" -Verbose
}

Write-Verbose "envOperationId = $envOperationId" -Verbose

$resourcesPropertyBag = Get-ResourcesProperties -resources $resources

if($copyFilesInParallel -eq "false" -or  ( $resources.Count -eq 1 ) )
{
    foreach($resource in $resources)
    {
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)

        $machine = $resourceProperties.fqdn        

        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $machine)

        $copyResponse = Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $additionalArguments
       
        $status = $copyResponse.Status
        Write-ResponseLogs -operationName "copy" -fqdn $machine -deploymentResponse $copyResponse
        
        Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $machine, $status)		

        if($status -ne "Passed")
        {
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
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)

        $machine = $resourceProperties.fqdn        

        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $machine)

        $job = Start-Job -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $additionalArguments

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

                 $displayName = $Jobs.Item($job.Id).fqdn
                 $resOperationId = $Jobs.Item($job.Id).resOperationId

                 Write-ResponseLogs -operationName "copy" -fqdn $displayName -deploymentResponse $output

                 Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)

                 if($status -ne "Passed")
                 {
                    $envOperationStatus = "Failed"
                    $errorMessage = ""
                    if($output.Error -ne $null)
                    {
                        $errorMessage = $output.Error.Message
                    }
                    Write-Output (Get-LocalizedString -Key "Copy failed on machine '{0}' with following message : '{1}'" -ArgumentList $displayName, $errorMessage)
                 }
              } 
        }
    }
}

if($envOperationStatus -ne "Passed")
{
    $errorMessage = (Get-LocalizedString -Key 'Copy to one or more machines failed.')
    ThrowError -errorMessage $errorMessage
}

Write-Verbose "Leaving script WindowsMachineFileCopy.ps1" -Verbose
