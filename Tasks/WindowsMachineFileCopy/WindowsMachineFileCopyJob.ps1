$CopyJob = {
param (
    [string]$fqdn, 
    [string]$sourcePath,
    [string]$targetPath,
    [object]$credential,
    [string]$cleanTargetBeforeCopy,
	[string]$winRMPort,
	[string]$httpProtocolOption,
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

	$cleanTargetPathOption = ''
   if($cleanTargetBeforeCopy -eq "true")
    {
		$cleanTargetPathOption = '-CleanTargetPath'
    }

    Write-Verbose "Initiating copy on $fqdn " -Verbose

   	[String]$copyFilesToTargetMachineBlockString = "Copy-FilesToTargetMachine -MachineDnsName $fqdn -SourcePath `$sourcePath -DestinationPath `$targetPath -Credential `$credential -WinRMPort $winRMPort $cleanTargetPathOption $skipCACheckOption $httpProtocolOption"	
		
	[scriptblock]$copyFilesToTargetMachineBlock = [scriptblock]::Create($copyFilesToTargetMachineBlockString)
	
	$copyResponse = Invoke-Command -ScriptBlock $copyFilesToTargetMachineBlock
    
    Write-Output $copyResponse
}