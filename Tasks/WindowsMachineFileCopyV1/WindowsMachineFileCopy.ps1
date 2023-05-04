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

. $PSScriptRoot/RoboCopyJob.ps1
. $PSScriptRoot/Utility.ps1

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal" -ErrorAction Ignore

# keep machineNames parameter name unchanged due to back compatibility
$machineFilter = $machineNames
$sourcePath = $sourcePath.Trim('"')
$targetPath = $targetPath.Trim('"')

# Default + constants #
$resourceFQDNKeyName = Get-ResourceFQDNTagKey

$envOperationStatus = 'Passed'

Validate-SourcePath $sourcePath
Validate-DestinationPath $targetPath $environmentName
Validate-AdditionalArguments $additionalArguments

if([string]::IsNullOrWhiteSpace($environmentName))
{
    Write-Verbose "No environment found. Copying to destination."

    Write-Output (Get-LocalizedString -Key "Copy started for - '{0}'" -ArgumentList $targetPath)
    Copy-OnLocalMachine -sourcePath $sourcePath -targetPath $targetPath -adminUserName $adminUserName -adminPassword $adminPassword `
                        -cleanTargetBeforeCopy $cleanTargetBeforeCopy -additionalArguments $additionalArguments
    Write-Verbose "Files copied to destination successfully."
}
else
{

    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName with filter $machineFilter"
    $environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $environmentName -UserName $adminUserName -Password $adminPassword -Connection $connection -TaskContext $distributedTaskContext -ResourceFilter $machineFilter
    Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName"

    $fetchedEnvironmentName = $environment.Name

    Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $fetchedEnvironmentName"
    $resources = Get-EnvironmentResources -Environment $environment
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
