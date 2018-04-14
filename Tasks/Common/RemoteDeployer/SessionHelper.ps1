function ConnectTo-RemoteMachine {
    [CmdletBinding()]
    Param (
        [string] $targetMachineName,
        [pscredential] $credential,
        [string] $protocol,
        [string] $authentication,
        [string] $sessionName,
        [ValidateRange(2,10)]
        [int] $maxRetryLimit = 3
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $retryCount = 0;
        $isConnectionComplete = $false
        $useSsl = ($protocol -eq "https")
        $machineDetails = Get-MachineDetails -MachineName $targetMachineName -useSsl:$useSsl
        $newPsSessionCommand = Get-NewPSSessionCommand -machineDetails $machineDetails `
                                                       -authentication $authentication `
                                                       -sessionName $sessionName `
                                                       -useSsl:$useSsl `
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
            Start-Sleep -Seconds 30
        }

        if ($isConnectionComplete) {
            Write-Verbose "Connection established to computer:'$($machineDetails.ComputerName)' port:'$($machineDetails.WSManPort)'"
            Write-Host $(Get-VstsLocString -Key "PS_TM_ConnectedMachines" -ArgumentList $targetMachineName)
            return $session    
        } else {
            foreach ($sessionError in $sessionErrors) {
                Write-VstsTaskError -Message $sessionError.Exception.Message -ErrCode "PS_TM_UnableToCreatePSSession"
            }
            Write-VstsSetResult -Result 'Failed' -Message $(Get-VstsLocString -Key "PS_TM_NotConnectedMachines" -ArgumentList $targetMachineName)
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-NewPSSessionCommand {
    [CmdletBinding()]
    Param (
        [hashtable] $machineDetails,
        [string] $authentication,
        [string] $sessionName,
        [switch] $useSsl,
        [switch] $NoCredential
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $newPsSessionCommandArgs = "-ComputerName '$($machineDetails.ComputerName)' -Port $($machineDetails.WSManPort) -Authentication $authentication -Name '$sessionName'"
        if(!$NoCredential) {
            $newPsSessionCommandArgs += " -Credential `$credential"    
        }
        if($useSsl) {
            $newPsSessionCommandArgs += " -UseSSL"
        }
        $newPsSessionCommandArgs += " -ErrorAction 'SilentlyContinue' -ErrorVariable sessionErrors"

        $newPsSessionCommand = "New-PSSession $newPsSessionCommandArgs"
        Write-Verbose "New-PSSessionCommand: $newPsSessionCommand"
        return $newPsSessionCommand
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-MachineDetails {
    [CmdletBinding()]
    Param (
        [Parameter(Mandatory = $true)]
        [string] $machineName,
        [switch] $useSsl
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $machineDetails = @{
            "ComputerName" = "";
            "WSManPort" = "";
        }
    
        $computerName, $port = $machineName.Split(':');
        if([string]::IsNullOrEmpty($port)) {
            if($useSsl) {
                $port = "5986"
            } else {
                $port = "5985"
            }
        }
    
        $machineDetails.ComputerName = $computerName
        $machineDetails.WSManPort = $port
        Write-Verbose "ComputerName = $($machineDetails.ComputerName)"
        Write-Verbose "WSManPort = $($machineDetails.WSManPort)"
        return $machineDetails
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}