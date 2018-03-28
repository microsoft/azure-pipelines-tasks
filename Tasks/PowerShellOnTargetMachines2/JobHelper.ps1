function Run-RemoteScriptJobs {
    [CmdletBinding()]
    Param (
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
                Receive-Job -Job $job |
                    ForEach-Object {
                         if($_.VstsTask -eq $true) { 
                             $jobResults += $_ 
                         } else { 
                             Write-Host $($_ | Out-String) 
                         }
                    }
            }
            Start-Sleep -Seconds 30
        }
    
        ForEach($job in $jobs) {
            Receive-Job -Job $job |
             ForEach-Object {
                  if($_.VstsTask -eq $true) {
                       $jobResults += $_ 
                    } else {
                         Write-Host $($_ | Out-String) 
                    } 
             }
        }
        
        Set-TaskResult -jobResults $jobResults
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Set-TaskResult {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [hashtable[]] $jobResults
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Paramter ""
    try {
        $failed = $false
        
        ForEach($jobResult in $jobResults) {
            if ($jobResult.Status -eq "Failed") {
                $failed = $true
                Write-VstsSetResult -Result 'Failed' -Message (Get-VstsLocString -Key "PS_TM_ScriptJobFailed" -ArgumentList $jobResult.ComputerName, $jobResult.Message) -DoNotThrow
            } elseif ($jobResult.Status -eq "Passed") {
                Write-Verbose "Remote script execution succeeded for machine: $($jobResult.ComputerName)"
                if($jobResult.ExitCode -ne 0) {
                    $failed = $true
                    Write-VstsSetResult -Result 'Failed' -Message (Get-VstsLocString -Key "PS_TM_NonZeroExitCode" -ArgumentList $jobResult.ComputerName, $jobResult.ExitCode) -DoNotThrow
                } else {
                    Write-Host $(Get-VstsLocString -Key "PS_TM_ScriptExecutionSucceeded" -ArgumentList $($jobResult.ComputerName))
                }
            } else {
                $failed = $true
                Write-VstsSetResult -Result 'Failed' -Message (Get-VstsLocString -Key "PS_TM_UnknownStatus" -ArgumentList $jobResult.Status) -DoNotThrow
            }
        }

        if(!$failed) {
            Write-VstsSetResult -Result 'Succeeded'
        }        
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}