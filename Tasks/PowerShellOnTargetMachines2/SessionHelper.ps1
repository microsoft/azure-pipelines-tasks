function Create-PSSessionToRemoteMachines {
    [CmdletBinding()]
    Param (
        [string[]] $targetMachineNames,
        [pscredential] $targetMachineCredential,
        [ValidateSet("http", "https")]
        [string] $protocol,
        [ValidateRange(2,10)]
        [int] $maxRetry = 3
    )

    $retryCount = 0;
    $sessions = @();

    if($protocol -eq "https") {
        $useSsl = $true
    } else {
        $useSsl = $false
    }

    $remainingMachines = $targetMachineNames | ForEach-Object { $_.ToLowerInvariant() }

    while($retryCount -lt $maxRetry) {
        Write-Verbose "Retry attempt #$($retryCount + 1)"
        $sessions += New-PSSession -ComputerName $remainingMachines -Credential $targetMachineCredential -UseSSL:$useSsl -ErrorAction "SilentlyContinue" -ErrorVariable sessionErrors
        ForEach($sessionError in $sessionErrors) {
            Write-Verbose $("New-PSSession Error: " + $sessionError.Exception.Message)
        }
        $connectedMachineNames = $sessions | Select-Object ComputerName | ForEach-Object { $_.ComputerName.ToLowerInvariant() }
        if($connectedMachineNames.Count -eq $targetMachineNames.Count) {
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

    ForEach($sessionError in $sessionErrors) {
        Write-VstsTaskError -Message $sessionError.Exception.Message -Code "PS_TM_UnableToCreatePSSession"
    }

    return $sessions
}