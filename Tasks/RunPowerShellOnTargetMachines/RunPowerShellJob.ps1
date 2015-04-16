$RunPowershellJob = {
param (
    [string]$environmentName,
    [guid]$envOperationId,
    [string]$fqdn, 
    [string]$scriptPath,
    [string]$port,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [object]$credential,
    [object]$connection
    )

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

    
    $resOperationId = Invoke-ResourceOperation -EnvironmentName $environmentName -ResourceName $fqdn -EnvironmentOperationId $envOperationId -ErrorAction Stop -Connection $connection

    Write-Verbose "ResourceOperationId = $resOperationId" -Verbose
    
    Write-Verbose "Initiating deployment on $fqdn" -Verbose

    $deploymentResponse = Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath $scriptPath -WinRMPort $port -Credential $credential -ScriptArguments $scriptArguments -InitializationScriptPath $initializationScriptPath –SkipCACheck -UseHttp

    $log = "Deployment Logs : " + $deploymentResponse.DeploymentLog + "`nService Logs : " + $deploymentResponse.ServiceLog;

    $response = $deploymentResponse

    $logs = New-Object 'System.Collections.Generic.List[System.Object]'         
    $resourceOperationLog = New-OperationLog -Content $log
    $logs.Add($resourceOperationLog)

    Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $response.Status -ErrorMessage $response.Error -Logs $logs -ErrorAction Stop -Connection $connection
    
    Write-Output $response
}
