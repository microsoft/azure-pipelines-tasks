function ConnectTo-RemoteMachines {
    [CmdletBinding()]
    Param (
        [string[]] $targetMachineNames,
        [pscredential] $targetMachineCredential,
        [ValidateSet("http", "https")]
        [string] $protocol,
        [ValidateSet("Default", "Credssp")]
        [string] $authenticationMechanism,
        [ValidateRange(2,10)]
        [int] $maxRetryLimit = 3
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $retryCount = 0;
        $sessions = @();
    
        $useSsl = ($protocol -eq "https")
        $authOption = [System.Management.Automation.Runspaces.AuthenticationMechanism]::$authenticationMechanism

        $remainingMachines = $targetMachineNames | ForEach-Object { $_.ToLowerInvariant() }
    
        while ($retryCount -lt $maxRetryLimit) {
            Write-Verbose "Trying to establish connection: Attempt #$($retryCount + 1)"
            $sessions += New-PSSession -ComputerName $remainingMachines -Credential $targetMachineCredential -Authentication $authOption -UseSSL:$useSsl -ErrorAction "SilentlyContinue" -ErrorVariable sessionErrors
            foreach ($sessionError in $sessionErrors) {
                Write-Verbose $("New-PSSession Error: " + $sessionError.Exception.Message)
            }
            $connectedMachineNames = $sessions | ForEach-Object { $_.ComputerName.ToLowerInvariant() }
            if($connectedMachineNames.Count -eq $targetMachineNames.Count) {
                Write-Verbose "All target machines have been connected"
                $remainingMachines = @();
                break;
            }
            $remainingMachines = $remainingMachines | Where-Object { $connectedMachineNames -notcontains $_ }
            $retryCount++
            Start-Sleep -Seconds 30
        }
    
        Write-Host $(Get-VstsLocString -Key "PS_TM_ConnectedMachines" -ArgumentList $($connectedMachineNames -join ','))
        if($remainingMachines.Count -gt 0) {
            foreach ($sessionError in $sessionErrors) {
                Write-VstsTaskError -Message $sessionError.Exception.Message -ErrCode "PS_TM_UnableToCreatePSSession"
            }
            Write-VstsSetResult -Result 'Failed' -Message $(Get-VstsLocString -Key "PS_TM_NotConnectedMachines" -ArgumentList $($remainingMachines -join ','))
        }
    
        return $sessions
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}