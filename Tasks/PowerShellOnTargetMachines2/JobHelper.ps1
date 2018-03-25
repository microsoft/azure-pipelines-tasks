function Run-RemoteScriptJobs {
    [CmdletBinding()]
    Param(
        [System.Management.Automation.Runspaces.PSSession[]] $sessions,
        [scriptblock] $script,
        [System.Array] $scriptArguments,
        [switch] $ignoreLASTEXITCODE
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter "sessions","scriptArguments"
    try {
        $jobs = Invoke-Command -Session $sessions -AsJob -ScriptBlock $script -ArgumentList $scriptArguments
        $jobResults = @();
    
        while($jobs | Where-Object { $_.State -eq "Running"}) {
            ForEach($job in $jobs) {
                Receive-Job -Job $job | ForEach-Object { if($_.VstsTask -eq $true) { $jobResults += $_ } else { Write-Host $($_ | Out-String) } }
            }
            Start-Sleep -Seconds 30
        }
    
        ForEach($job in $jobs) {
            Receive-Job -Job $job | ForEach-Object { if($_.VstsTask -eq $true) { $jobResults += $_ } else { Write-Host $($_ | Out-String) } }
        }
    
        ForEach($jobResult in $jobResults) {
            if($jobResult.ExitCode -ne 0) {
                Write-VstsSetResult -Result 'Failed' -Message (Get-VstsLocString -Key "PS_TM_NonZeroExitCode" -ArgumentList $jobResult.ComputerName, $jobResult.ExitCode) -DoNotThrow
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}