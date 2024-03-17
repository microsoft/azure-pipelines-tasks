########################################
# Private module variables.
########################################
$script:maximumSemaphoreAge = [timespan]::FromDays(1)
$script:sleepInterval = [timespan]::FromSeconds(10)

########################################
# Private functions.
########################################
function Lock-Semaphore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Share,
        [Parameter(Mandatory = $true)]
        [timespan]$MaximumWaitTime,
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreMessage)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $totalSleepTime = [timespan]::Zero
        $attemptedDelete = $false
        $semaphoreFile = [System.IO.Path]::Combine($Share, '_lockfile.sem')
        while ($true) {
            # Reached max wait time.
            if ($totalSleepTime -ge $MaximumWaitTime) {
                throw (Get-VstsLocString -Key ReachedPublishingMaxWaitTime0Seconds -ArgumentList $MaximumWaitTime.TotalSeconds)
            }

            try {
                # Semaphore file exists.
                if (Test-Path -LiteralPath $semaphoreFile -PathType Leaf) {
                    # File can be deleted.
                    if (!$attemptedDelete -and (Test-SemaphoreMaximumAge -SemaphoreFile $semaphoreFile)) {
                        # Try delete.
                        $attemptedDelete = $true
                        Remove-SemaphoreFile_Safe -SemaphoreFile $semaphoreFile # This function does not throw.

                        # Continue.
                        continue
                    }

                    # Warn, sleep, continue.
                    Write-Warning (Get-VstsLocString -Key SemaphoreFile0ExistsRetrying1Seconds -ArgumentList $semaphoreFile, $script:sleepInterval.TotalSeconds)
                    Start-Sleep -Seconds $script:sleepInterval.TotalSeconds;
                    $totalSleepTime += $script:sleepInterval;
                    continue;
                }

                # Checking for the existence of the share folder. In XAML Build, there was no semaphore file
                # and the users could enter a non-existent share and it would be created. So replicate that
                # functionality here (which was provided by symstore.exe in XAML build).
                if (!(Test-Path -LiteralPath $Share -PathType Container)) {
                    $null = [System.IO.Directory]::CreateDirectory($Share)
                    Write-Verbose "Created symbol store path at $Share since it did not exist."
                }

                # Create the semaphore file.
                [byte[]]$bytes = [System.Text.UTF8Encoding]::UTF8.GetBytes($SemaphoreMessage)
                $semaphore = [System.IO.File]::Open($semaphoreFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
                $semaphore.Write($bytes, 0, $bytes.Length)
                $semaphore.Flush()
                return New-Object psobject -Property @{
                    Path = $semaphoreFile
                    Stream = $semaphore
                }
            } catch [System.IO.IOException] {
                if ($_.Exception -is [System.IO.DirectoryNotFoundException] -or
                    $_.Exception -is [System.IO.PathTooLongException]) {
                    # Don't retry on these two exceptions.
                    throw
                }

                if ($_.Exception.HResult -eq -2147024843) {
                    # Network path not found. Don't retry on this exception.
                    # XAML build, via symstore.exe, would fail straight away in this scenario.
                    throw
                }

                # This will occur if the file is in use by another agent (the "typical, expected" case).
                # This will occur if the file gets created after the File.Exists check above but before File.Open.
                # It can also occur if the server does not exist or cannot be found.
                Write-Warning (Get-VstsLocString -Key Error0AccessingSemaphoreFile1Retrying2Seconds -ArgumentList $_.Exception.Message, $semaphoreFile, $script:sleepInterval.TotalSeconds)
            }

            # A retriable exception happened.
            # Sleep before trying again.
            Start-Sleep -Seconds $script:sleepInterval.TotalSeconds
            $totalSleepTime += $script:sleepInterval;
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Remove-SemaphoreFile_Safe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreFile)

    # Attempt to delete the semaphore file.
    Write-Warning (Get-VstsLocString -Key SemaphoreFile0Minutes1AttemptingCleanup -ArgumentList $semaphoreFile, $script:maximumSemaphoreAge.TotalMinutes)
    try {
        [System.IO.File]::Delete($semaphoreFile)
        Write-Warning (Get-VstsLocString -Key CleanedUpSemaphoreFile0 -ArgumentList $semaphoreFile)
    } catch {
        Write-Warning (Get-VstsLocString -Key CleanUpSemaphoreFile0Error1 -ArgumentList $semaphoreFile, $_.Message)
    }
}

function Test-SemaphoreMaximumAge {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreFile)

    # Check if the semaphore file is older than 24h and a deletion has not been attempted.
    $creationTimeUtc = [System.IO.File]::GetCreationTimeUtc($SemaphoreFile)
    Write-Verbose "Semaphore file creation time (UTC): $creationTimeUtc"
    $yesterdayUtc = [System.DateTime]::UtcNow.Subtract($script:maximumSemaphoreAge)
    return $creationTimeUtc -lt $yesterdayUtc
}

function Unlock-Semaphore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Semaphore)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $Semaphore.Stream.Dispose()
        [System.IO.File]::Delete($Semaphore.Path)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}