$RunPowershellJob = {
param (
    [string]$fqdn, 
    [string]$scriptPath,
    [string]$port,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [object]$credential,
	[string]$httpProtocolOption,
	[string]$skipCACheckOption
    )

	Write-Verbose "fqdn = $fqdn" -Verbose
    Write-Verbose "scriptPath = $scriptPath" -Verbose
    Write-Verbose "port = $port" -Verbose
    Write-Verbose "scriptArguments = $scriptArguments" -Verbose
    Write-Verbose "initializationScriptPath = $initializationScriptPath" -Verbose	
    Write-Verbose "protocolOption = $httpProtocolOption" -Verbose
    Write-Verbose "skipCACheckOption = $skipCACheckOption" -Verbose
    

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }    
   
    Write-Verbose "Initiating deployment on $fqdn" -Verbose
	[String]$psOnRemoteScriptBlockString = "Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath `$scriptPath -WinRMPort $port -Credential `$credential -ScriptArguments `$scriptArguments -InitializationScriptPath `$initializationScriptPath $skipCACheckOption $httpProtocolOption"
	
	[scriptblock]$psOnRemoteScriptBlock = [scriptblock]::Create($psOnRemoteScriptBlockString)
	
	$deploymentResponse = Invoke-Command -ScriptBlock $psOnRemoteScriptBlock
    
    Write-Output $deploymentResponse
}
