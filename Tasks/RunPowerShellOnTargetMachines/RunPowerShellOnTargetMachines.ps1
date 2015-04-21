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

. ./RunPowerShellJob.ps1

function Output-ResponseLogs
{
    param([string]$operationName,
          [string]$fqdn,
          [object]$deploymentResponse)

    Write-Verbose "Finished $operationName operation" -Verbose

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

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$connection = Get-VssConnection -TaskContext $distributedTaskContext

$port = '5985'

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -Connection $connection -ErrorAction Stop

$machineUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Username" -Connection $connection -ErrorAction Stop

$machinePassword = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Password" -Connection $connection -ErrorAction Stop

$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Deployment" -Connection $connection -ErrorAction Stop

Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose
$envOperationStatus = "Passed"
$deploymentError = ""

if($runPowershellInParallel -eq "false")
{
    foreach ($resource in $resources)
    {    
        $machine = $resource.Name
        Write-Output "Deployment Started for - $machine"

        $deploymentResponse = Invoke-Command -ScriptBlock $RunPowershellJob -ArgumentList $environmentName, $envOperationId, $machine, $scriptPath, $port, $scriptArguments, $initializationScriptPath, $credential, $connection

        Output-ResponseLogs -operationName "deployment" -fqdn $machine -deploymentResponse $deploymentResponse

        $status = $deploymentResponse.Status

        Write-Output "Deployment Status for machine $machine : $status"

        if ($status -ne "Passed")
        {
            Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -Connection $connection -ErrorAction Stop

            throw $deploymentResponse.Error;
        }
    }
}
else
{
    $Jobs = New-Object "System.Collections.Generic.Dictionary``2[int, string]"

    foreach($resource in $resources)
    {
        $machine = $resource.Name
	
        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $environmentName, $envOperationId, $machine, $scriptPath, $port, $scriptArguments, $initializationScriptPath, $credential, $connection

        $Jobs.Add($job.Id, $machine)
         
        Write-Output "Deployment Started for - $machine"
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
            
                 $machineName = $Jobs.Item($job.Id)

                 Output-ResponseLogs -operationName "Deployment" -fqdn $machineName -deploymentResponse $output
                 Write-Output "Deployment Status for machine $machineName : $status"
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