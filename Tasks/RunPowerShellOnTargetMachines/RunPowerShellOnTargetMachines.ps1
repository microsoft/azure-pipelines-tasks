param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$sourcePackage,
    [string]$scriptPath,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [string]$runPowershellInParallel
    )

Write-Verbose "Entering script RemotePowerShellRunner.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePackage = $sourcePackage" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "scriptArguments = $scriptArguments" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose

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

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -ErrorAction Stop -Connection $connection

$machineUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Username" -ErrorAction Stop -Connection $connection

$machinePassword = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Password" -ErrorAction Stop -Connection $connection

$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Deployment" -ErrorAction Stop -Connection $connection

Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose
$envOperationStatus = "Passed"

if($runPowershellInParallel -eq "false")
{
    foreach ($resource in $resources)
    {

        $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -ErrorAction Stop -Connection $connection

        Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
    
        $fqdn = $resource.Name
        
        Write-Output "Deployment will be Started for - $fqdn"
        Write-Verbose "Initiating deployment on $fqdn" -Verbose

        $deploymentResponse = Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath $scriptPath -WinRMPort $port -Credential $credential -ScriptArguments $scriptArguments -InitializationScriptPath $initializationScriptPath –SkipCACheck -UseHttp

        $log = "Deployment Logs : " + $deploymentResponse.DeploymentLog + "`nService Logs : " + $deploymentResponse.ServiceLog;

        Output-ResponseLogs -operationName "deployment" -fqdn $fqdn -deploymentResponse $deploymentResponse

        $response = $deploymentResponse
        $status = $response.Status
        Write-Output "Deployment Status for machine $fdqn : $status"

        $logs = New-Object 'System.Collections.Generic.List[System.Object]'         
        $resourceOperationLog = New-OperationLog -Content $log
        $logs.Add($resourceOperationLog)

        Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $response.Status -ErrorMessage $response.Error -Logs $logs -ErrorAction Stop -Connection $connection
    
        if ($response.Status -ne "Passed")
        {
            Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -ErrorAction Stop -Connection $connection

            throw $response.Error;
        }
    }
}
else
{
    $Jobs = New-Object "System.Collections.Generic.Dictionary``2[int, string]"

    foreach($resource in $resources)
    {
        $machine = $resource.Name
	
        Write-Output "Deployment will be Started for - $machine"

        $job = Start-Job -ScriptBlock $RunPowershellJob -ArgumentList $environmentName, $envOperationId, $machine, $scriptPath, $port, $scriptArguments, $initializationScriptPath, $credential, $connection

        $Jobs.Add($job.Id, $machine)
    
        Write-Output "Deployment Started for  - $machine"
    }
    While (Get-Job)
    {
         Start-Sleep 10 
         foreach($job in Get-Job)
         {
             if($job.State -ne "Running")
             {
                 $output = Receive-Job -Job $job
                 $result = $output.DeploymentLog
                 $status = $output.Status

                 if($status -ne "Passed")
                 {
                     $envOperationStatus = "Failed"
                 }
            
                 $machineName = $Jobs.Item($job.Id)

                 Output-ResponseLogs -operationName "Deployment" -fqdn $machineName -deploymentResponse $output
                 Write-Output "Result for machine $machineName : $result"
                 Write-Output "Deployment Status for machine $machineName : $status"
                 Remove-Job $Job
              } 
        }
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Passed" -ErrorAction Stop -Connection $connection

Write-Verbose "Leaving script RemotePowerShellRunner.ps1" -Verbose
