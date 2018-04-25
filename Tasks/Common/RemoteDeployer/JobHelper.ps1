$defaultScriptArgumentsValues = @{
    scriptPath = "";
    scriptArguments = "";
    inlineScript = "";
    inline = $true;
    workingDirectory = "";
    errorActionPreference = "continue";
    ignoreLASTEXITCODE = $false;
    failOnStdErr = $false;
    initializationScriptPath = "";
    sessionVariables = "";
}

function Run-RemoteScriptJobs {
    [CmdletBinding()]
    Param (
        [System.Management.Automation.Runspaces.PSSession[]] $sessions,
        [scriptblock] $script,
        [string] $sessionName,
        [hashtable] $scriptArgumentsByName,
        [hashtable[]] $targetMachines
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ""
    try {
        $totalTargetMachinesCount = $targetMachines.Count
        $scriptArguments = Get-ScriptArguments -scriptArgumentsByName $scriptArgumentsByName
        $jobName = [Guid]::NewGuid().ToString()
        $jobsInfo = (Invoke-Command -Session $sessions -AsJob -ScriptBlock $script -ArgumentList $scriptArguments -JobName $jobName -ErrorAction 'Stop').ChildJobs | Select-Object Id, Location
        $jobResults = Get-JobResults -jobsInfo $jobsInfo -targetMachines $targetMachines -sessionName $sessionName
        Set-TaskResult -jobResults $jobResults -machinesCount $totalTargetMachinesCount
        return $jobResults
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Set-TaskResult {
    [CmdletBinding()]
    param (
        [hashtable[]] $jobResults,
        [int] $machinesCount
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ""
    try {
        $failed = $false
        if(($jobResults -eq $null) -or ($jobResults.Count -ne $machinesCount)) {
            $failed = $true
            Write-Host (Get-VstsLocString -Key "RemoteDeployer_UnableToGetRemoteJobResults")
            Write-VstsSetResult -Result 'Failed' -Message "RemoteDeployer_UnableToGetRemoteJobResults" -DoNotThrow
        }
        ForEach($jobResult in $jobResults) {
            if ($jobResult.Status -eq "Failed") {
                $failed = $true
                Write-Host (Get-VstsLocString -Key "RemoteDeployer_ScriptJobFailed" -ArgumentList $jobResult.ComputerName, $jobResult.Message)
                Write-VstsSetResult -Result 'Failed' -Message "RemoteDeployer_ScriptJobFailed" -DoNotThrow
            } elseif ($jobResult.Status -eq "Passed") {
                Write-Verbose "Remote script execution completed for machine: $($jobResult.ComputerName)"
                if($jobResult.ExitCode -ne 0) {
                    $failed = $true
                    Write-Host (Get-VstsLocString -Key "RemoteDeployer_NonZeroExitCode" -ArgumentList $jobResult.ComputerName, $jobResult.ExitCode)
                    Write-VstsSetResult -Result 'Failed' -Message "RemoteDeployer_NonZeroExitCode" -DoNotThrow
                } else {
                    Write-Host $(Get-VstsLocString -Key "RemoteDeployer_ScriptExecutionSucceeded" -ArgumentList $($jobResult.ComputerName))
                }
            } else {
                $failed = $true
                Write-Host (Get-VstsLocString -Key "RemoteDeployer_UnknownStatus" -ArgumentList $jobResult.Status)
                Write-VstsSetResult -Result 'Failed' -Message "RemoteDeployer_UnknownStatus" -DoNotThrow
            }
        }
        if(!$failed) {
            Write-VstsSetResult -Result 'Succeeded'
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-ScriptArguments {
    Param (
        [hashtable] $scriptArgumentsByName
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        foreach($key in $defaultScriptArgumentsValues.Keys) {
            if(!$scriptArgumentsByName.ContainsKey($key)) {
                $scriptArgumentsByName[$key] = $defaultScriptArgumentsValues[$key]
            }
        }
        $scriptArguments = @(
            $scriptArgumentsByName.scriptPath,
            $scriptArgumentsByName.scriptArguments,
            $scriptArgumentsByName.inlineScript,
            $scriptArgumentsByName.inline,
            $scriptArgumentsByName.workingDirectory,
            $scriptArgumentsByName.errorActionPreference,
            $scriptArgumentsByName.ignoreLASTEXITCODE,
            $scriptArgumentsByName.failOnStdErr,
            $scriptArgumentsByName.initializationScriptPath,
            $scriptArgumentsByName.sessionVariables
        );
        return $scriptArguments
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-JobResults {
    Param (
        [psobject[]] $jobsInfo,
        [hashtable[]] $targetMachines,
        [string] $sessionName
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        $jobResults = @()
        $isRemoteExecutionFinished = $false
        $remoteExecutionStatusByLocation = @{}
        $connectionAttemptsByLocation = @{}
        foreach($jobInfo in $jobsInfo) {
            $remoteExecutionStatusByLocation[$jobInfo.Location] = "Unknown"
            $connectionAttemptsByLocation[$jobInfo.Location] = 0
        }

        while(!$isRemoteExecutionFinished) {
            foreach($jobInfo in $jobsInfo) {
                $jobId = $jobInfo.Id
                $computerName = $jobInfo.Location
                if($remoteExecutionStatusByLocation[$computerName] -eq "Unknown") {
                    $job = Get-Job -Id $jobId
                    $jobState = $job.State.ToString().ToLowerInvariant()
                    Write-Verbose "JobId: '$jobid', JobState: '$jobState', ComputerName: '$computerName'"
                    Receive-Job -Job $job |
                        ForEach-Object {
                            if($_.VstsTaskJobResult -eq $true) { 
                                $jobResults += $_ 
                            } else { 
                                Write-Host $($_ | Out-String) 
                            }
                        }
                        
                    if($jobState -eq "completed") {
                        $remoteExecutionStatusByLocation[$computerName] = "Finished"
                    } else {
                        Write-Verbose "Job (Id = $jobId) is in undesirable state (State = $jobState). Attempting reconnection"
                        if($connectionAttemptsByLocation[$computerName] -ge 15) {
                            Write-Verbose "Maximum connection retry limit reached for computerName: $computerName"
                            $remoteExecutionStatusByLocation[$computerName] = "Finished"
                        } else {
                            $newJobId = Retry-Connection -targetMachines $targetMachines -computerName $computerName -sessionName $sessionName
                            if($newJobId -ne $null) {
                                Write-Verbose "Connection re-established to computer: $computerName, JobId (New): $newJobId, JobId(Old): $($jobInfo.Id)"
                                Stop-Job -Id $jobInfo.Id
                                $jobInfo.Id = $newJobId
                                $connectionAttemptsByLocation[$computerName] = 0;
                            } else {
                                Write-Verbose "Unable to re-establish connection to computer: $computerName. Retry attempt #$($connectionAttemptsByLocation[$computerName])"
                                $connectionAttemptsByLocation[$computerName]++;
                            }
                        }
                    }
                }
            }

            $isRemoteExecutionFinished = $true
            foreach($value in $remoteExecutionStatusByLocation.Values) {
                if($value -eq "Unknown") {
                    $isRemoteExecutionFinished = $false
                    break;
                }
            }

            Start-Sleep -Seconds 30
        }
        return $jobResults
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}