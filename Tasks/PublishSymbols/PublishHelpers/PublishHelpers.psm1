[CmdletBinding()]
param()

function Invoke-PublishSymbols {
    [CmdletBinding()]
    param(
        [string[]]$PdbFiles,
        [Parameter(Mandatory = $true)]
        [string]$Share,
        [Parameter(Mandatory = $true)]
        [string]$Product,
        [Parameter(Mandatory = $true)]
        [string]$Version,
        [Parameter(Mandatory = $true)]
        [timespan]$MaximumWaitTime,
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreMessage,
        [string]$ArtifactName)

    if (!$PdbFiles.Count) {
        Write-Warning (Get-VstsLocString -Key NoFilesForPublishing)
        return
    }

    [string]$symbolsRspFile = ''
    try {
        [string]$symstorePath = Assert-VstsPath -LiteralPath "$env:Agent_HomeDirectory\Agent\Worker\Tools\Symstore\symstore.exe" -PathType Leaf -PassThru
        $symbolsRspFile = New-ResponseFile
        Invoke-PublishSymbolsCore -SymbolsRspFile $symbolsRspFile -SymstorePath $symstorePath -Share $Share -Product $Product -Version $Version -MaximumWaitTime $MaximumWaitTime -SemaphoreMessage $SemaphoreMessage -ArtifactName $ArtifactName
    } finally {
        if ($symbolsRspFile) {
            [System.IO.File]::Delete($symbolsRspFile)
        }
    }
}

function Invoke-PublishSymbolsCore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SymbolsRspFile,
        [Parameter(Mandatory = $true)]
        [string]$SymstorePath,
        [Parameter(Mandatory = $true)]
        [string]$Share,
        [Parameter(Mandatory = $true)]
        [string]$Product,
        [Parameter(Mandatory = $true)]
        [string]$Version,
        [Parameter(Mandatory = $true)]
        [timespan]$MaximumWaitTime,
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreMessage,
        [string]$ArtifactName)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $MaximumWaitTime = Get-ValidValue -Current $MaximumWaitTime -Minimum ([timespan]::FromMinutes(1)) -Maximum ([timespan]::FromHours(3))
        $MaximumSemaphoreAge = [timespan]::FromDays(1)
        $sleepInterval = [timespan]::FromSeconds(10)
        $totalSleepTime = [timespan]::Zero
        $attemptedDelete = $false
        $semaphoreFile = [System.IO.Path]::Combine($Share, '_lockfile.sem')
        while ($totalSleepTime -lt $MaximumWaitTime) {
            try {
                # Check to see if the semaphore file exists.
                if (Test-Path -LiteralPath $semaphoreFile -PathType Leaf) {
                    $creationTimeUtc = [System.IO.File]::GetCreationTimeUtc($semaphoreFile)
                    Write-Verbose "Semaphore file creation time (UTC): $creationTimeUtc"
                    $yesterdayUtc = [System.DateTime]::UtcNow.Subtract($MaximumSemaphoreAge)
                    # Check if the semaphore file is older than 24h (configurable).
                    if ($creationTimeUtc -lt $yesterdayUtc -and !$attemptedDelete) { # This doesn't prevent this worker or other agents from trying to delete the file on the very next build.
                        Write-Warning (Get-VstsLocString -Key SemaphoreFile0Minutes1AttemptingCleanup -ArgumentList $semaphoreFile, $MaximumSemaphoreAge.TotalMinutes)
                        if (Test-Path -LiteralPath $SemaphoreMessage -PathType Leaf) {
                            try {
                                # Try to clean up the file.
                                $attemptedDelete = $true
                                [System.IO.File]::Delete($semaphoreFile)
                                Write-Warning (Get-VstsLocString -Key CleanedUpSemaphoreFile0 -ArgumentList $semaphoreFile)
                                # The semaphore file was cleaned up.
                                # Retry the loop.
                                continue
                            } catch {
                                # Cleanup failed. Continue to try to publish symbols.
                                Write-Warning (Get-VstsLocString -Key CleanUpSemaphoreFile0Error1 -ArgumentList $semaphoreFile, $_.Message)
                            }
                        }
                    }

                    Write-Warning (Get-VstsLocString -Key SemaphoreFile0ExistsRetrying1Seconds -ArgumentList $semaphoreFile, $sleepInterval.TotalSeconds)
                    Start-Sleep -Seconds $sleepInterval.TotalSeconds;
                    $totalSleepTime += $sleepInterval;
                    continue;
                }

                # Checking for the existence of the semaphore file on the share. In XAML Build, there was no semaphore file and the users could
                # enter a non-existent share and it would be created. So replicate that functionality here (which was provided by symstore.exe in XAML build).
                if (!(Test-Path -LiteralPath $Share -PathType Container)) {
                    $null = [System.IO.Directory]::CreateDirectory($Share)
                    Write-Verbose "Created symbol store path at $Share since it did not exist."
                }

                if (!$SemaphoreMessage) {
                    $SemaphoreMessage = "Machine: $env:COMPUTERNAME at $([datetime]::UtcNow) UTC"
                }

                [byte[]]$bytes = [System.Text.UTF8Encoding]::UTF8.GetBytes($SemaphoreMessage)
                $semaphoreFileStream = [System.IO.File]::Open($semaphoreFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
                try {
                    $semaphoreFileStream.Write($bytes, 0, $bytes.Length)
                    $symstoreArgs = "add /f ""@$SymbolsRspFile"" /s ""$Share"" /t ""$Product"" /v ""$Version"""
                    Invoke-VstsTool -FileName $SymstorePath -Arguments $symstoreArgs -WorkingDirectory ([System.IO.Path]::GetTempPath()) 2>&1 |
                        ForEach-Object {
                            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                                Write-Error $_
                            } else {
                                Write-Verbose $_
                            }
                        }
                } finally {
                    $semaphoreFileStream.Dispose()
                }

                [System.IO.File]::Delete($semaphoreFile)
                if (!$ArtifactName) {
                    if ($lastTransactionId = Get-LastTransactionId) {
                        $ArtifactName = $lastTransactionId
                    } else {
                        $ArtifactName = [guid]::NewGuid().ToString() 
                    }
                }

                Write-VstsAssociateArtifact -Name $ArtifactName -Path $Share
                break
            } catch [System.IO.IOException] {
                if ($_.Exception -is [System.IO.DirectoryNotFoundException] -or
                    $_.Exception -is [System.IO.PathTooLongException]) {
                    # Don't retry on these two exceptions.
                    throw
                }

                if ($_.Exception.HResult -eq -2147024843) {
                    # Network path not found. Don't rety on this exception.
                    # XAML build, via symstore.exe, would fail straight away in this scenario.
                    throw
                }

                # This will occur if the file is in use by another agent (the "typical, expected" case).
                # This will occur if the file gets created after the File.Exists check above but before File.Open.
                # It can also occur if the server does not exist or cannot be found.
                Write-Warning (Get-VstsLocString -Key Error0AccessingSemaphoreFile1Retrying2Seconds, $_.Exception.Message, $semaphoreFile, $sleepInterval.TotalSeconds)

                # Retry if we get other IOExceptions
                Start-Sleep -Seconds $sleepInterval.TotalSeconds
                $totalSleepTime += $sleepInterval;
            } catch {
                # Don't retry on exceptions.
                Write-Error -Exception $_.Exception
                break
            } finally {
                if ($totalSleepTime -ge $MaximumWaitTime) {
                    Write-Error (Get-VstsLocString -Key ReachedPublishingMaxWaitTime0Seconds -ArgumentList $MaximumWaitTime.TotalSeconds)
                }
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-LastTransactionId {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Share)

    [string]$lastIdFileName = [System.IO.Path]::Combine($Share, '000Admin\lastid.txt')
    if (Test-Path -LiteralPath $lastIdFileName -PathType Leaf) {
        # There is a slight chance this file won't exist (due to timing).
        # If we hit that case, it will propagate a FileNotFoundException
        # or DirectoryNotFoundException.
        [System.IO.File]::ReadAllText($lastIdFileName).Trim()
    } else {
        $lastIdFileName = [System.IO.Path]::Combine($Share, "000Admin")
        Write-Warning (Get-VstsLocString -Key SymbolStoreLastIdTxtNotFoundAt0 -ArgumentList $lastIdFileName)
    }
}

function Get-ValidValue {
    [CmdletBinding()]
    param(
        [timespan]$Current,
        [timespan]$Minimum,
        [timespan]$Maximum)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Current -lt $Minimum) {
            return $Minimum
        } elseif ($Current -gt $Maximum) {
            return $Maximum
        }

        return $Current
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function New-ResponseFile {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $symbolsRspFile = [System.IO.Path]::GetTempFileName()
        $sw = New-Object System.IO.StreamWriter([System.IO.File]::OpenWrite($symbolsRspFile))
        try {
            foreach ($pdbFile in $PdbFiles) {
                if (Test-Path -LiteralPath $PdbFile -PathType Leaf) {
                    $sw.WriteLine($pdbFile)
                }
            }
        } finally {
            $sw.Dispose()
        }

        $symbolsRspFile
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

Export-ModuleMember -Function 'Invoke-PublishSymbols'
