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

Write-Verbose "Entering script WindowsMachineFileCopy.ps1"
Write-Verbose "environmentName = $environmentName"
Write-Verbose "adminUserName = $adminUserName"
Write-Verbose "resourceFilteringMethod = $resourceFilteringMethod"
Write-Verbose "machineNames = $machineNames"
Write-Verbose "sourcePath = $sourcePath"
Write-Verbose "targetPath = $targetPath"
Write-Verbose "additionalArguments = $additionalArguments"
Write-Verbose "copyFilesInParallel = $copyFilesInParallel"
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy"

. ./RoboCopyJob.ps1

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

$isAgentVersion97 = ((gcm Register-Environment).Parameters.ContainsKey("Persist"));

function ThrowError
{
    param([string]$errorMessage)
  
        throw "$errorMessage"
}

function Get-ResourceConnectionDetails
{
    param(
        [string]$envName,
        [object]$resource
        )

    $resourceProperties = @{}

    $resourceName = $resource.Name
    $resourceId = $resource.Id

    Write-Verbose "`t`t Starting Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName"
    if($isAgentVersion97)
    {
        $fqdn = Get-EnvironmentProperty -Environment $environment -Key $resourceFQDNKeyName -ResourceId $resourceId -ErrorAction Stop
    }
    else
    {
        $fqdn = Get-EnvironmentProperty -EnvironmentName $envName -Key $resourceFQDNKeyName -TaskContext $distributedTaskContext -ResourceId $resourceId -ErrorAction Stop 
    }
    Write-Verbose "`t`t Completed Get-EnvironmentProperty cmdlet call on environment name: $environmentName with resource id: $resourceId(Name : $resourceName) and key: $resourceFQDNKeyName"

    Write-Verbose "`t`t Resource fqdn - $fqdn"	

    $resourceProperties.fqdn = $fqdn
    $resourceProperties.credential = Get-ResourceCredentials -resource $resource    

    return $resourceProperties
}

function Get-ResourcesProperties
{
    param(
        [string]$envName,
        [object]$resources
        )    

    [hashtable]$resourcesPropertyBag = @{}

    foreach ($resource in $resources)
    {
        $resourceName = $resource.Name
        $resourceId = $resource.Id
        Write-Verbose "Get Resource properties for $resourceName (ResourceId = $resourceId)"		

        # Get other connection details for resource like - fqdn wirmport, http protocol, skipCACheckOption, resource credentials

        $resourceProperties = Get-ResourceConnectionDetails -envName $envName -resource $resource        
        
        $resourcesPropertyBag.Add($resourceId, $resourceProperties)
    }
    return $resourcesPropertyBag
}

function Validate-Null(
    [string]$value,
    [string]$variableName
    )
{
    $value = $value.Trim()    
    if(-not $value)
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Parameter '{0}' cannot be null or empty." -ArgumentList $variableName)
    }
}

function Validate-SourcePath(
    [string]$value
    )
{
    Validate-Null -value $value -variableName "sourcePath"

    if(-not (Test-Path $value))
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Source path '{0}' does not exist." -ArgumentList $value)
    }
}

function Validate-DestinationPath(
    [string]$value,
    [string]$environmentName
    )
{
    Validate-Null -value $value -variableName "targetPath"

    if($environmentName -and $value.StartsWith("`$env:"))
    {
        ThrowError -errorMessage (Get-LocalizedString -Key "Remote destination path '{0}' cannot contain environment variables." -ArgumentList $value)
    }
}


Validate-SourcePath $sourcePath
Validate-DestinationPath $targetPath $environmentName

if([string]::IsNullOrWhiteSpace($environmentName))
{
    Write-Verbose "No environment found. Copying to destination."

    Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $targetPath)
    $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $adminUserName, $adminPassword
    Invoke-Command -ScriptBlock $CopyJob -ArgumentList "", $sourcePath, $targetPath, $credential, $cleanTargetBeforeCopy, $additionalArguments
}
else
{

    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName with filter $machineFilter"
    $environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $environmentName -UserName $adminUserName -Password $adminPassword -Connection $connection -TaskContext $distributedTaskContext -ResourceFilter $machineFilter
    Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName"

    $fetchedEnvironmentName = $environment.Name

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $fetchedEnvironmentName"
    if($isAgentVersion97)
    {
        $resources = Get-EnvironmentResources -Environment $environment
    }
    else
    {
        $resources = Get-EnvironmentResources -EnvironmentName $fetchedEnvironmentName -TaskContext $distributedTaskContext
    }
    Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $fetchedEnvironmentName"

    if ($resources.Count -eq 0)
    {
         throw (Get-LocalizedString -Key "No machine exists under environment: '{0}' for deployment" -ArgumentList $environmentName)
    }

    $resourcesPropertyBag = Get-ResourcesProperties -envName $fetchedEnvironmentName -resources $resources

    if($copyFilesInParallel -eq "false" -or  ( $resources.Count -eq 1 ))
    {
        foreach($resource in $resources)
        {
            $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
            $machine = $resourceProperties.fqdn        

            Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $machine)

            Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $additionalArguments
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

        While ($Jobs.Count -gt 0)
        {
            Start-Sleep 10 
            foreach($job in Get-Job)
            {
                if($Jobs.ContainsKey($job.Id) -and $job.State -ne "Running")
                {
                    Receive-Job -Id $job.Id
                    Remove-Job $Job                 
                    $Jobs.Remove($job.Id)
                } 
            }
        }
    }
}

Write-Verbose "Leaving script WindowsMachineFileCopy.ps1"
