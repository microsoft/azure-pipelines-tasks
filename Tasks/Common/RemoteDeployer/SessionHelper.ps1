function Get-WinRmConnectionToTargetMachine {
    [CmdletBinding()]
    Param (
        [string] $computerName,
        [string] $port,
        [pscredential] $credential,
        [string] $authentication,
        [string] $sessionName,
        [string] $sessionConfigurationName,
        [switch] $useSsl,
        [ValidateRange(1,10)]
        [int] $maxRetryLimit = 3,
        [ValidateRange(5, 60)]
        [int] $timeoutPeriod = 30
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $retryCount = 0;
        $isConnectionComplete = $false
        $newPsSessionCommand = Get-NewPSSessionCommand -computerName $computerName `
                                                       -port $port `
                                                       -authentication $authentication `
                                                       -sessionName $sessionName `
                                                       -useSsl:$useSsl `
                                                       -sessionConfigurationName $sessionConfigurationName `
                                                       -NoCredential:($credential -eq $null)

        while ($retryCount -lt $maxRetryLimit) {
            Write-Verbose "Trying to establish connection: Attempt #$($retryCount + 1)"
            $session = (Invoke-Expression $newPsSessionCommand)
            
            foreach ($sessionError in $sessionErrors) {
                Write-Verbose $("New-PSSession Error: " + $sessionError.Exception.Message)
            }

            if($session -ne $null) {
                $isConnectionComplete = $true
                break;
            }

            $retryCount++
            Start-Sleep -Seconds $timeoutPeriod
        }

        if ($isConnectionComplete) {
            Write-Verbose "Connection established to computer:'$computerName' port:'$port'"
            Write-Host $(Get-VstsLocString -Key "RemoteDeployer_ConnectedMachines" -ArgumentList $computerName)
            return $session    
        } else {
            foreach ($sessionError in $sessionErrors) {
                Write-Error (Get-VstsLocString -Key "PS_TM_UnableToCreatePSSession" -ArgumentList ($sessionError.Exception.Message))
            }
            throw (Get-VstsLocString -Key "RemoteDeployer_NotConnectedMachines" -ArgumentList $computerName, $port)
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-NewPSSessionCommand {
    [CmdletBinding()]
    Param (
        [string] $computerName,
        [string] $port,
        [string] $authentication,
        [string] $sessionName,
        [string] $sessionConfigurationName,
        [switch] $useSsl,
        [switch] $NoCredential
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $newPsSessionCommandArgs = "-ComputerName '$computerName' -Port $port -Authentication $authentication -Name '$sessionName'"
        if(!$NoCredential) {
            $newPsSessionCommandArgs += " -Credential `$credential"    
        }
        if($useSsl) {
            $newPsSessionCommandArgs += " -UseSSL"
        }
        $newPsSessionCommandArgs += " -ErrorAction 'SilentlyContinue' -ErrorVariable sessionErrors"
        $newPsSessionCommandArgs += " -ConfigurationName '$sessionConfigurationName'"

        $newPsSessionCommand = "New-PSSession $newPsSessionCommandArgs"
        Write-Verbose "New-PSSessionCommand: $newPsSessionCommand"
        return $newPsSessionCommand
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Retry-Connection {
    [CmdletBinding()]
    Param (
        [psobject[]] $targetMachines,
        [string] $computerName,
        [string] $sessionName
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        $targetMachine = $targetMachines | Where-Object { $_.ComputerName.ToLowerInvariant() -eq $computerName.ToLowerInvariant() }
        if($targetMachine -eq $null) {
            $allComputerNames = $($targetMachines | ForEach-Object { $_.ComputerName }) -join ','
            Write-Verbose "Unable to find target machine: '$computerName' in the list of target machines: '$allComputerNames'"
        } else {
            if($targetMachine.Credential -eq $null) {
                $remoteSession = Get-PSSession  -ComputerName $($targetMachine.ComputerName) `
                                                -Name $sessionName `
                                                -ConfigurationName ($targetMachine.SessionConfigurationName) `
                                                -Port ($targetMachine.WSManPort) `
                                                -Authentication ($targetMachine.Authentication) `
                                                -UseSSL:$($targetMachine.UseSsl)
            } else {
                $remoteSession = Get-PSSession  -ComputerName ($targetMachine.ComputerName) `
                                                -Name $sessionName `
                                                -ConfigurationName ($targetMachine.SessionConfigurationName) `
                                                -Credential ($targetMachine.Credential) `
                                                -Port ($targetMachine.WSManPort) `
                                                -Authentication ($targetMachine.Authentication) `
                                                -UseSSL:$($targetMachine.UseSsl)
            }
    
            if($remoteSession -eq $null) {
                Write-Verbose "Unable to get remote pssession with name: '$sessionName' on remote computer: '$($targetMachine.ComputerName)'"
            } else {
                if(($remoteSession.State.ToString().ToLowerInvariant() -eq "disconnected") -and ($remoteSession.Availability.ToString().ToLowerInvariant() -eq "none")) {
                    Write-Verbose "Session: '$sessionName' is available for reconnection on remote computer: '$($targetMachine.ComputerName)'"
                    $job = Receive-PSSession -Session $remoteSession -OutTarget Job -ErrorAction 'Stop'
                    return ($job.ChildJobs[0].Id)
                } else {
                    Write-Verbose "Remote PSSession unavailable for connection. PSSessionState: '$($remoteSession.State)'. PSSessionAvailability: '$($remoteSession.Availability)'"
                }
            }
        }
    } catch {
        Write-Verbose "Error during reconnection attempt: $($_.Exception.ToString())"
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
    return $null
}