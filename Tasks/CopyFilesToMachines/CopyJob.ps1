$CopyJob = {
param (
    [string]$fqdn, 
    [string]$sourcePath,
    [string]$targetPath,
    [string]$username,
	[string]$password,
    [string]$cleanTargetBeforeCopy
    )

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }

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
    
    Write-Output $copyResponse
}