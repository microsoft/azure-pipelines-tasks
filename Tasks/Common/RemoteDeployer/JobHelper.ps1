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
        [hashtable[]] $targetMachines,
        [psobject] $sessionOption,
        [scriptblock] $outputHandler,
        [scriptblock] $errorHandler
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ""
    try {
        $totalTargetMachinesCount = $targetMachines.Count
        Write-Verbose "Total no. of target machines: $totalTargetMachinesCount"
        $scriptArguments = Get-ScriptArguments -scriptArgumentsByName $scriptArgumentsByName
        $jobName = [Guid]::NewGuid().ToString()
        $parentJob = Invoke-Command -Session $sessions `
                                    -ScriptBlock $script `
                                    -ArgumentList $scriptArguments `
                                    -JobName $jobName `
                                    -AsJob `
                                    -ErrorAction 'Stop'
        $jobsInfo = $parentJob.ChildJobs | Select-Object Id, Location, @{ Name = 'JobRetrievelCount'; Expression = { 0 } }

        $jobResults = Get-JobResults -jobsInfo $jobsInfo `
                                     -targetMachines $targetMachines `
                                     -sessionName $sessionName `
                                     -sessionOption $sessionOption `
                                     -outputHandler $outputHandler `
                                     -errorHandler $errorHandler
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
        $errCodes = @()
        $failed = $false
        if(($jobResults -eq $null) -or ($jobResults.Count -ne $machinesCount)) {
            $failed = $true
            Write-Error (Get-VstsLocString -Key "RemoteDeployer_UnableToGetRemoteJobResults")
            $errCodes += "RemoteDeployer_UnableToGetRemoteJobResults"
        }
        ForEach($jobResult in $jobResults) {
            if ($jobResult.Status -eq "Failed") {
                $failed = $true
                Write-Error (Get-VstsLocString -Key "RemoteDeployer_ScriptJobFailed" -ArgumentList $jobResult.ComputerName, $jobResult.Message)
                $errCodes += "RemoteDeployer_ScriptJobFailed"
            } elseif ($jobResult.Status -eq "Passed") {
                Write-Verbose "Remote script execution completed for machine: $($jobResult.ComputerName)"
                if($jobResult.ExitCode -ne 0) {
                    $failed = $true
                    Write-Error (Get-VstsLocString -Key "RemoteDeployer_NonZeroExitCode" -ArgumentList $jobResult.ComputerName, $jobResult.ExitCode)
                    $errCodes += "RemoteDeployer_NonZeroExitCode"
                } else {
                    Write-Host $(Get-VstsLocString -Key "RemoteDeployer_ScriptExecutionSucceeded" -ArgumentList $($jobResult.ComputerName))
                }
            } else {
                $failed = $true
                Write-Error (Get-VstsLocString -Key "RemoteDeployer_UnknownStatus" -ArgumentList $jobResult.Status)
                $errCodes += "RemoteDeployer_UnknownStatus"
            }
        }
        if(!$failed) {
            Write-VstsSetResult -Result 'Succeeded'
        } else {
            $errMessage = $errCodes -join ','
            throw (Get-VstsLocString -Key "RemoteDeployer_JobResultEvaluationFailure" -ArgumentList $errMessage)
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
        [string] $sessionName,
        [psobject] $sessionOption,
        [scriptblock] $outputHandler,
        [scriptblock] $errorHandler
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
                    try {
                        $job = Get-Job -Id $jobId -ErrorAction 'Stop'
                    } catch {
                        Write-Verbose "Unable to get job with id: '$jobId'. Error: '$($_.Exception.Message)'"
                        Write-Verbose $_.Exception.ToString()
                        $jobInfo.JobRetrievelCount++
                        if($jobInfo.JobRetrievelCount -ge 3) {
                            Write-Verbose "Maximum job retrievel count reached for jobid: '$jobId'. Dropping job."
                            $remoteExecutionStatusByLocation[$computerName] = "Finished"
                        }
                        continue;
                    }
                    $jobInfo.JobRetrievelCount = 0
                    $jobState = $job.State.ToString().ToLowerInvariant()
                    Write-Verbose "JobId: '$jobid', JobState: '$jobState', ComputerName: '$computerName'"
                    Receive-Job -Job $job |
                        ForEach-Object {
                            if($_.VstsRemoteDeployerJobResult -eq $true) { 
                                if($_ -is [hashtable]) {
                                    $_.Remove("VstsRemoteDeployerJobResult")
                                    $jobResults += $_ 
                                } else {
                                    Write-Verbose "jobResult is not a hashtable"
                                    Write-Verbose $_.ToString();
                                }
                            } else {
                                if($_ -is [System.Management.Automation.ErrorRecord]) {
                                    $errorRecord = $_
                                    $null = & { try { & $errorHandler $errorRecord $($job.Location) } catch { Write-Host "ErrorHandlerException: $($_.Exception.ToString())" } }
                                } else {
                                    $outputObject = $_
                                    $null = & { try { & $outputHandler $outputObject $($job.Location) } catch { Write-Host "OutputHandlerException: $($_.Exception.ToString())" } }
                                }
                            }
                        }
                        
                    if($jobState -eq "completed") {
                        $remoteExecutionStatusByLocation[$computerName] = "Finished"
                    } elseif($jobState -ne "running") {
                        Write-Verbose "Job (Id = $jobId) is in undesirable state (State = $jobState). Attempting reconnection"
                        if($connectionAttemptsByLocation[$computerName] -ge 15) {
                            Write-Verbose "Maximum connection retry limit reached for computerName: $computerName"
                            $remoteExecutionStatusByLocation[$computerName] = "Finished"
                        } else {
                            $newJobId = Retry-Connection -targetMachines $targetMachines -computerName $computerName -sessionName $sessionName -sessionOption $sessionOption
                            if($newJobId -ne $null) {
                                Write-Verbose "Connection re-established to computer: $computerName, JobId (New): $newJobId, JobId(Old): $($jobInfo.Id)"
                                Stop-Job -Id $jobInfo.Id
                                $jobInfo.Id = $newJobId
                                $jobInfo.JobRetrievelCount = 0
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

            if($isRemoteExecutionFinished -eq $false) {
                Start-Sleep -Seconds 30
            }
        }
        return $jobResults
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}