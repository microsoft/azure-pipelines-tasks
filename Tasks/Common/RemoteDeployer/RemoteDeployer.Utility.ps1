function Get-TargetMachines {
    [CmdletBinding()]
    Param (
        [string[]] $targetMachineNames,
        [pscredential] $credential,
        [string] $authentication,
        [string] $sessionConfigurationName,
        [switch] $useSsl
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        Write-Verbose "Target Machines: $($targetMachineNames -join ',')"
        $targetMachines = @();
        foreach($targetMachineName in $targetMachineNames) {
            $targetMachine = @{
                ComputerName = "";
                WSManPort = "";
                Credential = $credential;
                Authentication = $authentication;
                SessionConfigurationName = $sessionConfigurationName;
                UseSsl = $useSsl
            }
        
            # if port if provided with machine name, use it, else default it based on protocol
            $computerName, $port = $targetMachineName.Split(':');
            if([string]::IsNullOrEmpty($port)) {
                if($useSsl) {
                    $port = "5986"
                } else {
                    $port = "5985"
                }
            }
            $targetMachine.ComputerName = $computerName.Trim()
            $targetMachine.WSManPort = $port.Trim()

            Write-Verbose "ComputerName = $($targetMachine.ComputerName)"
            Write-Verbose "WSManPort = $($targetMachine.WSManPort)"
            Write-Verbose "Authentication = $($targetMachine.Authentication)"
            Write-Verbose "SessionConfigurationName = $($targetMachine.SessionConfigurationName)"
            Write-Verbose "UseSSL = $($targetMachine.UseSsl)"
            $targetMachines += $targetMachine
        }
        Write-Verbose "Total target machines are: $($targetMachines.Length)"
        return $targetMachines
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Publish-Telemetry {
    Param([hashtable[]] $jobResults)
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        $buildOrReleaseJobId = Get-VstsTaskVariable -Name 'System.JobId'
        foreach($jobResult in $jobResults) {
            $telemetryData = @{
                "IsAzureVm" = $jobResult.IsAzureVM;
                "VmUuidHash" = $jobResult.MachineGuidHash;
                # field name 'TelemetryError' is misleading here. TelemetryError is only the type of the Telemetry exception.
                "TelemetryError" = $jobResult.TelemetryError;
                "JobId" = $buildOrReleaseJobId;
            }
            $telemetryDataJson = ConvertTo-Json $telemetryData
            $telemetryDataJson = $telemetryDataJson.Replace([environment]::NewLine, '').Trim()
            Write-Verbose "Telemetry Data is: $telemetryDataJson"
            $telemetry = "##vso[telemetry.publish area=TaskHub;feature=PowerShellOnTargetMachines]$telemetryDataJson"
            Write-Host $telemetry
        }
    } catch {
        Write-Verbose "Unable to publish telemetry data. Error: $($_.Exception.Message)"
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-TemporaryLogsFolder {
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $agentTempDirectory = Get-VstsTaskVariable -Name 'Agent.TempDirectory'
        $tempFolderName = [Guid]::NewGuid().ToString()
        $tempLogsFolder = [System.IO.Path]::Combine($agentTempDirectory, $tempFolderName)
        if((Test-Path -LiteralPath $tempLogsFolder -PathType 'Container') -eq $true) {
            Get-ChildItem -Path $tempLogsFolder -Force -Recurse | Sort-Object -Property FullName -Descending | Remove-Item -Recurse -Force
        }
        $tempLogsFolder = (New-Item -Path $agentTempDirectory -Name $tempFolderName -ItemType 'Container').FullName
        return $tempLogsFolder
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Upload-TargetMachineLogs {
    Param( [string] $logsFolder )
    
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation
    if((Test-Path -LiteralPath $logsFolder -PathType 'Container') -eq $true) {
        try {
            $logFiles = Get-ChildItem -LiteralPath $logsFolder -Filter "*.log"
            foreach($logFile in $logFiles) {
                Write-Host "##vso[task.uploadfile]$($logFile.FullName)"
            }
        } catch {
            Write-Error (Get-VstsLocString -Key "RemoteDeployer_UnableToUploadTargetMachineLogs" -ArgumentList $logsFolder, $_.Exception.Message)
        }
    }
    Trace-VstsLeavingInvocation $MyInvocation
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
        if(($jobResults -eq $null) -or ($jobResults.Length -ne $machinesCount)) {
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

$defaultErrorHandler = {
    Param($object, $computerName)
    Write-Host ($object | Out-String)
}

$defaultOutputHandler = {
    Param($object, $computerName)
    Write-Host ($object | Out-String)
}
