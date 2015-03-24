param (
    [string]$environmentName,
    [string]$machineNames, 
    [string]$sourcePackage,
    [string]$applicationPath,
    [string]$scriptPath,
    [string]$initializationScriptPath,
    [string]$alternateCredentialsUsername,
    [string]$alternateCredentialsPassword
    )

Write-Verbose "Entering script RemotePowerShellRunner.ps1" -Verbose
Write-Verbose "environmentName = $environmentName" -Verbose
Write-Verbose "machineNames = $machineNames" -Verbose
Write-Verbose "sourcePackage = $sourcePackage" -Verbose
Write-Verbose "applicationPath = $applicationPath" -Verbose
Write-Verbose "scriptPath = $scriptPath" -Verbose
Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose

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

import-module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

$env:DTL_ALTERNATE_CREDENTIALS_USERNAME = $alternateCredentialsUsername
$env:DTL_ALTERNATE_CREDENTIALS_PASSWORD = $alternateCredentialsPassword

$port = '5985'

$resources = Get-EnvironmentResources -EnvironmentName $environmentName -ResourceFilter $machineNames -ErrorAction Stop

$machineUserName = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Username" -ErrorAction Stop

$machinePassword = Get-EnvironmentProperty -EnvironmentName $environmentName -Key "Password" -ErrorAction Stop

$credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $machineUserName, $machinePassword

$envOperationId = Invoke-EnvironmentOperation -EnvironmentName $environmentName -OperationName "Deployment" -ErrorAction Stop

Write-Verbose "EnvironmentOperationId = $envOperationId" -Verbose

foreach ($resource in $resources)
{
    $logs = New-Object 'System.Collections.Generic.List[Microsoft.VisualStudio.Services.DevTestLabs.Model.Log]'

    $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $resource.Name -EnvironmentOperationId $envOperationId -ErrorAction Stop

    Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
    
    $fqdn = $resource.Name

    Write-Verbose "Initiating copy on $fqdn, username: $machineUserName" -Verbose

    $copyResponse = Copy-FilesToRemote -MachineDnsName $fqdn -SourceLocalPath $sourcePackage -DestinationLocalPath $applicationPath -Credential $credential

    $log = "Deployment Logs : " + $copyResponse.DeploymentLog + "`nService Logs : " + $copyResponse.ServiceLog

    Output-ResponseLogs -operationName "copy" -fqdn $fqdn -deploymentResponse $copyResponse

    $response = $copyResponse
    
    if ($copyResponse.Status -eq "Passed")
    {
        Write-Verbose "Initiating deployment on $fqdn" -Verbose

        $deploymentResponse = Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath $scriptPath -WinRMPort $port -Credential $credential -InitializationScriptPath $initializationScriptPath -ApplicationPath $applicationPath –SkipCACheck -UseHttp

        $log = "Deployment Logs : " + $deploymentResponse.DeploymentLog + "`nService Logs : " + $deploymentResponse.ServiceLog;

        Output-ResponseLogs -operationName "deployment" -fqdn $fqdn -deploymentResponse $deploymentResponse

        $response = $deploymentResponse
    }

	$resourceOperationLog = New-Object Microsoft.VisualStudio.Services.DevTestLabs.Model.Log
	$resourceOperationLog.Content = $log
    $logs.Add($resourceOperationLog)

    Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $response.Status -ErrorMessage $response.Error -Logs $logs -ErrorAction Stop
    
    if ($response.Status -ne "Passed")
    {
        Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Failed" -ErrorAction Stop

        throw $response.Error;
    }
}

Complete-EnvironmentOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -Status "Passed" -ErrorAction Stop

Write-Verbose "Leaving script RemotePowerShellRunner.ps1" -Verbose
