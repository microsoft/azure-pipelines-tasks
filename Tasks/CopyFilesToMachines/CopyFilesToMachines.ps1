param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$sourcePath,
    [string]$targetPath,
    [string]$cleanTargetBeforeCopy,
    [string]$deployFilesInParallel
    )

Write-Verbose "Entering script DeployFilesToMachines.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePath = $sourcePath" -Verbose
Write-Verbose "targetPath = $targetPath" -Verbose
Write-Verbose "deployFilesInParallel = $deployFilesInParallel" -Verbose
Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy" -Verbose

. ./CopyJob.ps1

function Output-ResponseLogs
{
    param([string]$operationName,
          [string]$fqdn,
          [object]$deploymentResponse)

    Write-Verbose "Finished $operationName operation on $fqdn" -Verbose

    if ([string]::IsNullOrEmpty($deploymentResponse.DeploymentLog) -eq $false)
    {
        Write-Verbose "Deployment logs for $operationName operation on $fqdn " -Verbose
        Write-Verbose ($deploymentResponse.DeploymentLog | Format-List | Out-String) -Verbose
    }
    if ([string]::IsNullOrEmpty($deploymentResponse.ServiceLog) -eq $false)
    {
        Write-Verbose "Service logs for $operationName operation on $fqdn " -Verbose
        Write-Verbose ($deploymentResponse.ServiceLog | Format-List | Out-String) -Verbose
    }
}

import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$connection = Get-VssConnection -TaskContext $distributedTaskContext

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection -ErrorAction Stop

$machineUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Username" -Connection $connection -ErrorAction Stop

$machinePassword = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Password" -Connection $connection -ErrorAction Stop

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Copy Files" -Connection $connection -ErrorAction Stop

Write-Verbose "envOperationId = $envOperationId" -Verbose
$envOperationStatus = "Passed"

if($deployFilesInParallel -eq "false")
{
    foreach($resource in $resources)
    {
        $machine = $resource.Name
        Write-Output "Copy Started for - $machine"

        $copyResponse = Invoke-Command -ScriptBlock $CopyJob -ArgumentList $environmentName, $envOperationId, $machine, $sourcePath, $targetPath, $machineUserName, $machinePassword, $cleanTargetBeforeCopy, $connection
       
        $status = $copyResponse.Status
        Output-ResponseLogs -operationName "copy" -fqdn $machine -deploymentResponse $copyResponse
        Write-Output "Copy Status for machine $machine : $status"

        if($status -ne "Passed")
        {
             $envOperationStatus = "Failed"
             break
        }
    } 
}

else
{
    $Jobs = New-Object "System.Collections.Generic.Dictionary``2[int, string]"

    foreach($resource in $resources)
    {
        $machine = $resource.Name

        $job = Start-Job -ScriptBlock $CopyJob -ArgumentList $environmentName, $envOperationId, $machine, $sourcePath, $targetPath, $machineUserName, $machinePassword, $cleanTargetBeforeCopy, $connection

        $Jobs.Add($job.Id, $machine)
    
        Write-Output "Copy Started for - $machine"
    }

    While (Get-Job)
    {
         Start-Sleep 10 
         foreach($job in Get-Job)
         {
             if($job.State -ne "Running")
             {
                 $output = Receive-Job -Job $job
                 Remove-Job $Job
                 $status = $output.Status

                 if($status -ne "Passed")
                 {
                     $envOperationStatus = "Failed"
                 }
            
                 $machineName = $Jobs.Item($job.Id)

                 Output-ResponseLogs -operationName "copy" -fqdn $machineName -deploymentResponse $output
                 Write-Output "Copy Status for machine $machineName : $status"
              } 
        }
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status $envOperationStatus -Connection $connection -ErrorAction Stop

if($envOperationStatus -ne "Passed")
{
    throw "copy to one or more machine failed."
}

