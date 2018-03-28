function Create-PSSessionToRemoteMachines {
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
            $connectedMachineNames = $sessions | Select-Object ComputerName | ForEach-Object { $_.ComputerName.ToLowerInvariant() }
            if($connectedMachineNames.Count -eq $targetMachineNames.Count) {
                $remainingMachines = @();
                break;
            }
            $remainingMachines = $remainingMachines | Where-Object { -not ($connectedMachineNames -contains $_) }
            $retryCount++
            Start-Sleep -Seconds 30
        }
    
        Write-Host $(Get-VstsLocString -Key "PS_TM_ConnectedMachines" -ArgumentList $($connectedMachineNames -join ','))
        if($remainingMachines.Count -gt 0) {
            Write-Warning $(Get-VstsLocString -Key "PS_TM_NotConnectedMachines" -ArgumentList $($remainingMachines -join ','))
        }
    
        foreach ($sessionError in $sessionErrors) {
            Write-VstsTaskError -Message $sessionError.Exception.Message -ErrCode "PS_TM_UnableToCreatePSSession"
        }
    
        return $sessions
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}