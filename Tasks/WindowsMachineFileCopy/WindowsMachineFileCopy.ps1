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

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

# keep machineNames parameter name unchanged due to back compatibility
$machineFilter = $machineNames
$sourcePath = $sourcePath.Trim('"')
$targetPath = $targetPath.Trim('"')

# Default + constants #
$defaultWinRMPort = '5985'
$defaultSkipCACheckOption = ''
$defaultConnectionProtocolOption = '-UseHttp' 

$resourceFQDNKeyName = Get-ResourceFQDNTagKey
$resourceWinRMHttpPortKeyName = Get-ResourceHttpTagKey
$resourceWinRMHttpsPortKeyName = Get-ResourceHttpsTagKey
$skipCACheckKeyName = Get-SkipCACheckTagKey

$doSkipCACheckOption = '-SkipCACheck'
$doNotSkipCACheckOption = ''
$useHttpProtocolOption = '-UseHttp'
$useHttpsProtocolOption = ''
$envOperationStatus = 'Passed'

function ThrowError
{
    param([string]$errorMessage)
    
        $readmelink = "http://aka.ms/windowsfilecopyreadme"
        $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
        throw "$errorMessage $helpMessage"
}

function Get-SkipCACheckOption
{
    param([string]$environmentName,
          [Microsoft.VisualStudio.Services.Client.VssConnection]$connection)

    $skipCACheckOption = $doSkipCACheckOption

    # get skipCACheck option from environment
    Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose
    $skipCACheckBool = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $skipCACheckKeyName -Connection $connection
    Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with key: $skipCACheckKeyName" -Verbose

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
    $resourceId = $resource.Id

    Write-Verbose "`t`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose
    $fqdn = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceFQDNKeyName -Connection $connection -ResourceId $resourceId -ErrorAction Stop
    Write-Verbose "`t`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName" -Verbose

    Write-Verbose "`t`t Resource fqdn - $fqdn" -Verbose	

    $resourceProperties.fqdn = $fqdn

    $winrmPortToUse = ''
    $protocolToUse = ''

    # check whether http port is defined for resource
    Write-Verbose "`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose
    $winrmHttpPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpPortKeyName -Connection $connection -ResourceId $resourceId
    Write-Verbose "`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpPortKeyName" -Verbose

    if ([string]::IsNullOrEmpty($winrmHttpPort))
    {
        Write-Verbose "`t Resource: $resourceName (Id : $resourceId) does not have any winrm http port defined, checking for winrm https port" -Verbose

        Write-Verbose "Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose
        $winrmHttpsPort = Get-EnvironmentProperty -EnvironmentName $environmentName -Key $resourceWinRMHttpsPortKeyName -Connection $connection -ResourceId $resourceId
        Write-Verbose "Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceWinRMHttpsPortKeyName" -Verbose

        # if resource does not have any port defined then, use https port by default
        if ([string]::IsNullOrEmpty($winrmHttpsPort))
        {
            Write-Verbose "`t Resource: $resourceName (Id : $resourceId) does not have any winrm https port or http port defined, using http port by default" -Verbose
            $winrmPortToUse = $defaultWinRMPort
            $protocolToUse = $defaultConnectionProtocolOption
        }
        else
        {
            # if resource has winrm https port defined
            $winrmPortToUse = $winrmHttpsPort
            $protocolToUse = $useHttpsProtocolOption
        }
    }
    else
    {
        # if resource has winrm http port opened
        $winrmPortToUse = $winrmHttpPort
        $protocolToUse = $useHttpProtocolOption
    }
    
    $resourceProperties.winrmPort = $winrmPortToUse
    $resourceProperties.httpProtocolOption = $protocolToUse
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource
    $resourceProperties.displayName = $fqdn + ":" + $winrmPortToUse

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
        $resourceId = $resource.Id
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)" -Verbose		

        # Get other connection details for resource like - fqdn wirmport, http protocol, skipCACheckOption, resource credentials

        $resourceProperties = Get-ResourceConnectionDetails -resource $resource
        $resourceProperties.skipCACheckOption = $skipCACheckOption
        
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
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)

        $machine = $resourceProperties.fqdn
        $displayName = $resourceProperties.displayName

        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $displayName)

        $copyResponse = Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $resourceProperties.winrmPort, $resourceProperties.httpProtocolOption, $resourceProperties.skipCACheckOption
       
        $status = $copyResponse.Status
        Write-ResponseLogs -operationName "copy" -fqdn $displayName -deploymentResponse $copyResponse
        
        Write-Output (Get-LocalizedString -Key "Copy status for machine '{0}' : '{1}'" -ArgumentList $displayName, $status)		

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
        $resourceProperties = $resourcesPropertyBag.Item($resource.Id)

        $machine = $resourceProperties.fqdn
        $displayName = $resourceProperties.displayName

        Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $displayName)

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

                 $displayName = $Jobs.Item($job.Id).displayName
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

Write-Verbose "Starting Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose
Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop
Write-Verbose "Completed Complete-EnvironmentOperation cmdlet call on environment name: $environmentName with environment operationId: $envOperationId and status: $envOperationStatus" -Verbose

if($envOperationStatus -ne "Passed")
{
    $errorMessage = (Get-LocalizedString -Key 'Copy to one or more machines failed.')
    ThrowError -errorMessage $errorMessage
}

Write-Verbose "Leaving script WindowsMachineFileCopy.ps1" -Verbose
