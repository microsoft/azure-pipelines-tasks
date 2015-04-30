$RunPowershellJob = {
param (
    [string]$fqdn, 
    [string]$scriptPath,
    [string]$port,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [object]$credential,
	[string]$httpProtocallOption,
	[string]$skipCACheckOption
    )

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }    
   
    Write-Verbose "Initiating deployment on $fqdn" -Verbose
    
	[String]$psOnRemoteScriptBlockString = "Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath $scriptPath -WinRMPort $port -Credential `$credential -ScriptArguments `$scriptArguments -InitializationScriptPath $initializationScriptPath $skipCACheckOption $httpProtocallOption"
	
	[scriptblock]$psOnRemoteScriptBlock = [scriptblock]::Create($psOnRemoteScriptBlockString)
	
	$deploymentResponse = Invoke-Command -ScriptBlock $psOnRemoteScriptBlock

    $log = "Deployment Logs : " + $deploymentResponse.DeploymentLog + "`nService Logs : " + $deploymentResponse.ServiceLog;
	
    Write-Output $deploymentResponse
}
