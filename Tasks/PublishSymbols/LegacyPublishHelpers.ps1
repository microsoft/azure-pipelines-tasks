########################################
# (Script-scope variables) Derived from PublishHelpers\SemaphoreFunctions.ps1.
########################################
$script:maximumSemaphoreAge = [timespan]::FromDays(1)
$script:sleepInterval = [timespan]::FromSeconds(10)

########################################
# Derived from PublishHelpers\CommonFunctions.ps1
########################################
function Get-SymStorePath {
    $symstorePath = Get-ToolPath -Name 'Symstore\symstore.exe'
    $null = Get-Item -LiteralPath $symstorePath -ErrorAction Stop
    $symstorePath
}

function Get-ValidValue {
    [CmdletBinding()]
    param(
        [timespan]$Current,
        [timespan]$Minimum,
        [timespan]$Maximum)

    Write-Verbose "Entering Get-ValidValue"
    Write-Verbose " Current: '$Current'"
    Write-Verbose " Minimum '$Minimum'"
    Write-Verbose " Maximum: '$Maximum'"
    try {
        if ($Current -lt $Minimum) { return $Minimum }
        elseif ($Current -gt $Maximum) { return $Maximum }
        else { return $Current }
    } finally {
        Write-Verbose "Leaving Get-ValidValue"
    }
}

########################################
# Derived from PublishHelpers\UnpublishFunctions.ps1.
########################################
function Invoke-UnpublishSymbols {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Share,
        [Parameter(Mandatory = $true)]
        [string]$TransactionId,
        [Parameter(Mandatory = $true)]
        [timespan]$MaximumWaitTime,
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreMessage)

    Write-Verbose "Entering Invoke-UnpublishSymbols"
    Write-Verbose " Share: '$Share'"
    Write-Verbose " TransactionId: '$TransactionId'"
    Write-Verbose " MaximumWaitTime: '$MaximumWaitTime'"
    Write-Verbose " SemaphoreMessage: '$SemaphoreMessage'"
    try {
        $MaximumWaitTime = Get-ValidValue -Current $MaximumWaitTime -Minimum ([timespan]::FromMinutes(1)) -Maximum ([timespan]::FromHours(3))
        Push-Location -LiteralPath ([System.IO.Path]::GetTempPath()) -ErrorAction Stop
        try {
            $semaphore = Lock-Semaphore -Share $Share -MaximumWaitTime $MaximumWaitTime -SemaphoreMessage $SemaphoreMessage
            try {
                & (Get-SymStorePath) del /i $TransactionId /s $Share 2>&1 |
                    ForEach-Object {
                        if ($_ -is [System.Management.Automation.ErrorRecord]) {
                            Write-Error $_
                        } else {
                            Write-Host $_
                        }
                    }
                if ($LASTEXITCODE -ne 0) {
                    throw (Get-LocalizedString -Key "Symstore.exe completed with exit code '{0}'." -ArgumentList $LASTEXITCODE)
                }
            } finally {
                Unlock-Semaphore $semaphore
            }
        } finally {
            Pop-Location
        }
    } finally {
        Write-Verbose "Leaving Invoke-UnpublishSymbols"
    }
}

########################################
# Derived from PublishHelpers\SemaphoreFunctions.ps1.
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

    Write-Verbose "Entering Lock-Semaphore"
    Write-Verbose " Share: '$Share'"
    Write-Verbose " MaximumWaitTime: '$MaximumWaitTime'"
    Write-Verbose " SemaphoreMessage '$SemaphoreMessage'"
    try {
        $totalSleepTime = [timespan]::Zero
        $attemptedDelete = $false
        $semaphoreFile = [System.IO.Path]::Combine($Share, '_lockfile.sem')
        while ($true) {
            # Reached max wait time.
            if ($totalSleepTime -ge $MaximumWaitTime) {
                throw (Get-LocalizedString -Key "Symbol publishing could not be completed.  Reached maximum wait time of {0} seconds." -ArgumentList $MaximumWaitTime.TotalSeconds)
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
                    Write-Warning (Get-LocalizedString -Key "Semaphore file {0} already exists.  Retrying symbol publishing in {1} seconds..." -ArgumentList $semaphoreFile, $script:sleepInterval.TotalSeconds)
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
                Write-Warning (Get-LocalizedString -Key "{0} Accessing semaphore file: {1}, Retrying symbol publishing in {2} seconds..." -ArgumentList $_.Exception.Message, $semaphoreFile, $script:sleepInterval.TotalSeconds)
            }

            # A retriable exception happened.
            # Sleep before trying again.
            Start-Sleep -Seconds $script:sleepInterval.TotalSeconds
            $totalSleepTime += $script:sleepInterval;
        }
    } finally {
        Write-Verbose "Leaving Lock-Semaphore"
    }
}

function Remove-SemaphoreFile_Safe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreFile)

    # Attempt to delete the semaphore file.
    Write-Warning (Get-LocalizedString -Key "Semaphore file {0} already exists and was last accessed over {1} minutes ago.  Attempting to clean up." -ArgumentList $semaphoreFile, $script:maximumSemaphoreAge.TotalMinutes)
    try {
        [System.IO.File]::Delete($semaphoreFile)
        Write-Warning (Get-LocalizedString -Key "Semaphore file {0} was cleaned up successfully." -ArgumentList $semaphoreFile)
    } catch {
        Write-Warning (Get-LocalizedString -Key "Could not clean up the existing semaphore file {0}.  Error: {1}" -ArgumentList $semaphoreFile, $_.Message)
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

    Write-Verbose "Entering Unlock-Semaphore"
    try {
        $Semaphore.Stream.Dispose()
        [System.IO.File]::Delete($Semaphore.Path)
    } finally {
        Write-Verbose "Leaving Unlock-Semaphore"
    }
}
