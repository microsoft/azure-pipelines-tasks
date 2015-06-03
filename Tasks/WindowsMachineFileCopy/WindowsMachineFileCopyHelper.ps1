# Creating Build Uri to be used as log content
$teamFoundationCollectionUri = $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI
$teamProject = $env:SYSTEM_TEAMPROJECT
$buildId = $env:BUILD_BUILDID
$buildUri = $teamFoundationCollectionUri + $teamProject + "/_build#_a=summary&buildId=" + $buildId

function DoComplete-ResourceOperation
{
    param([string]$environmentName,
          [guid]$envOperationId,
          [guid]$resOperationId,
          [object]$connection,
          [object]$deploymentResponse)
    
    # $log = "Copy Logs : " + $deploymentResponse.DeploymentLog + "`nService Logs : " + $deploymentResponse.ServiceLog;
    
    # Uploading BuildUri as log content.	
    $logs = New-Object 'System.Collections.Generic.List[System.Object]'
    $resourceOperationLog = New-OperationLog -Content $buildUri
    $logs.Add($resourceOperationLog)

    Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $deploymentResponse.Status -ErrorMessage $deploymentResponse.Error -Logs $logs -Connection $connection -ErrorAction Stop
}

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