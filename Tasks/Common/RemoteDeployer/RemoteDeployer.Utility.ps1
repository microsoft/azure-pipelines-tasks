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
        Write-Verbose "Total target machines are: $($targetMachines.Count)"
        return $targetMachines
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Publish-Telemetry {
    Param([hashtable[]] $jobResults)
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        $jobId = Get-VstsTaskVariable -Name 'System.JobId'
        foreach($jobResult in $jobResults) {
            $telemetryData = @{
                "IsAzureVm" = $jobResult.IsAzureVM;
                "VmUuidHash" = $jobResult.MachineGuidHash;
                "TelemetryError" = $jobResult.TelemetryError;
                "JobId" = $jobId
            }
            $telemetryDataJson = ConvertTo-Json $telemetryData
            $telemetryDataJson = $telemetryDataJson.Replace([environment]::NewLine, '').Trim()
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
        $tempFolderName = "PS_TM_v3"
        $tempLogsFolder = [System.IO.Path]::Combine($agentTempDirectory, $tempFolderName)
        if((Test-Path -LiteralPath $tempLogsFolder -PathType 'Container') -eq $true) {
            Remove-Item -LiteralPath $tempLogsFolder -Force
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

$defaultErrorHandler = {
    Param($object, $computerName)
    Write-Host ($object | Out-String)
}

$defaultOutputHandler = {
    Param($object, $computerName)
    Write-Host ($object | Out-String)
}