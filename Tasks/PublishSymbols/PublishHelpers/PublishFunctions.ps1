########################################
# Public functions.
########################################
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

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Short-circuit if no files.
        if (!$PdbFiles.Count) {
            Write-Warning (Get-VstsLocString -Key NoFilesForPublishing)
            return
        }

        [string]$symbolsRspFile = ''
        try {
            # Write the list of PDBs to the response file.
            $symbolsRspFile = New-ResponseFile -PdbFiles $PdbFiles

            # Adjust the max wait time if out of range.
            $MaximumWaitTime = Get-ValidValue -Current $MaximumWaitTime -Minimum ([timespan]::FromMinutes(1)) -Maximum ([timespan]::FromHours(3))

            # Obtain the semaphore.
            $semaphore = Lock-Semaphore -Share $Share -MaximumWaitTime $MaximumWaitTime -SemaphoreMessage $SemaphoreMessage
            try {
                # Invoke symstore.exe.
                $symstoreArgs = "add /f ""@$symbolsRspFile"" /s ""$Share"" /t ""$Product"" /v ""$Version"""
                Invoke-VstsTool -FileName (Get-SymStorePath) -Arguments $symstoreArgs -WorkingDirectory ([System.IO.Path]::GetTempPath()) 2>&1 |
                    ForEach-Object {
                        if ($_ -is [System.Management.Automation.ErrorRecord]) {
                            Write-Error $_
                        } else {
                            Write-Verbose $_
                        }
                    }
                $lastTransactionId = Get-LastTransactionId -Share $Share
            } finally {
                # Release the semaphore.
                Unlock-Semaphore $semaphore
            }

            # Default the artifact name.
            $ArtifactName = Get-ArtifactName -ArtifactName $ArtifactName -LastTransactionId $lastTransactionId

            # Create the artifact.
            Write-VstsAssociateArtifact -Name $ArtifactName -Path $Share -Type 'SymbolStore' -Properties @{
                TransactionId = $lastTransactionId
            }
        } finally {
            # Delete the temporary response file.
            if ($symbolsRspFile) {
                [System.IO.File]::Delete($symbolsRspFile)
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Private functions.
########################################
function Get-ArtifactName {
    [CmdletBinding()]
    param($ArtifactName, $LastTransactionId)

    if ($ArtifactName) { $ArtifactName }
    elseif ($LastTransactionId) { $LastTransactionId }
    else { [guid]::NewGuid().ToString() }
}

function Get-LastTransactionId {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Share)

    [string]$lastIdFileName = [System.IO.Path]::Combine($Share, '000Admin\lastid.txt')
    if (Test-Path -LiteralPath $lastIdFileName -PathType Leaf) {
        [System.IO.File]::ReadAllText($lastIdFileName).Trim()
    } else {
        Write-Warning (Get-VstsLocString -Key SymbolStoreLastIdTxtNotFoundAt0 -ArgumentList ([System.IO.Path]::Combine($Share, "000Admin")))
    }
}

function New-ResponseFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$PdbFiles)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $symbolsRspFile = [System.IO.Path]::GetTempFileName()
        $sw = New-Object System.IO.StreamWriter([System.IO.File]::OpenWrite($symbolsRspFile))
        try {
            foreach ($pdbFile in $PdbFiles) {
                $sw.WriteLine($pdbFile)
            }

            $sw.Flush()
        } finally {
            $sw.Dispose()
        }

        $symbolsRspFile
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
