$CopyJob = {
param (
    [string]$environmentName,
    [guid]$envOperationId,
    [string]$fqdn, 
    [string]$sourcePath,
    [string]$targetPath,
    [string]$username,
	[string]$password,
    [string]$cleanTargetBeforeCopy,
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

   Write-Verbose "ResourceOperationId = $resOperationId for resource $fqdn" -Verbose

   $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $username, $password

   Write-Verbose "Initiating copy on $fqdn, username: $username" -Verbose

   if($cleanTargetBeforeCopy -eq "true")
    {
         $copyResponse = Copy-FilesToTargetMachine -MachineDnsName $fqdn -SourcePath $sourcePath -DestinationPath $targetPath -Credential $credential -CleanTargetPath -SkipCACheck -UseHttp
    }

    else
    {
         $copyResponse = Copy-FilesToTargetMachine -MachineDnsName $fqdn -SourcePath $sourcePath -DestinationPath $targetPath -Credential $credential -SkipCACheck -UseHttp
    }

    $logs = New-Object 'System.Collections.Generic.List[System.Object]'
    $log = "Deployment Logs : " + $copyResponse.DeploymentLog + "`nService Logs : " + $copyResponse.ServiceLog               
    $resourceOperationLog = New-OperationLog -Content $log
    $logs.Add($resourceOperationLog)

	Complete-ResourceOperation -EnvironmentName $environmentName -EnvironmentOperationId $envOperationId -ResourceOperationId $resOperationId -Status $copyResponse.Status -ErrorMessage $copyResponse.Error -Logs $logs -ErrorAction Stop -Connection $connection
    
    Write-Output $copyResponse
}