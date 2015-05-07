function DoComplete-ResourceOperation
{
    param([string]$environmentName,
		  [guid]$envOperationId,
		  [guid]$resOperationId,
		  [object]$connection,
		  [object]$deploymentResponse)
    
	$log = "Deployment Logs : " + $deploymentResponse.DeploymentLog + "`nService Logs : " + $deploymentResponse.ServiceLog;

    $logs = New-Object 'System.Collections.Generic.List[System.Object]'         
    $resourceOperationLog = New-OperationLog -Content $log
    $logs.Add($resourceOperationLog)

    Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $deploymentResponse.Status -ErrorMessage $deploymentResponse.Error -Logs $logs -Connection $connection -ErrorAction Stop
}

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