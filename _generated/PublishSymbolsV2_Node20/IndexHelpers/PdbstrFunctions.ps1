function Add-SourceServerStream {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PdbStrPath,

        [Parameter(Mandatory = $true)]
        [string]$SymbolsFilePath,

        [Parameter(Mandatory = $true)]
        [string]$StreamContent
    )

    Trace-VstsEnteringInvocation $MyInvocation -Parameter @( )
    try {
        # Create a temp file to store the stream content.
        $streamContentFilePath = Get-TempFileName
        try {
            # For encoding consistency with previous implementation, use File.WriteAllText(...) instead
            # of Out-File. From ildasm, it appears WriteAllText uses UTF8 with no BOM. It's impossible
            # to use the no-BOM UTF8 encoding with Set-Content or Out-File. Therefore, in order to be
            # able to stub out the call, created a small wrapper function instead.
            Write-AllText -Path $streamContentFilePath -Content $StreamContent
            Write-Verbose "Temp stream content file: $streamContentFilePath"

            # Store the original symbols file path.
            [string]$originalSymbolsFilePath = $SymbolsFilePath
            try {
                # Pdbstr.exe doesn't work with symbols files with a space in the path. If the symbols file
                # has a space in file path, then pdbstr.exe just prints the command usage information over
                # STDOUT. It doesn't inject the indexing info into the PDB file, doesn't write to STDERR,
                # and doesn't return a non-zero exit code.
                if ($SymbolsFilePath.Contains(' ')) {
                    # Create a temp file.
                    Write-Verbose "Space in path. Copying to temp file."
                    $SymbolsFilePath = Get-TempFileName

                    # If the temp file contains a space in the path, then the Invoke-IndexSources function
                    # would have already printed a warning. No need to check and warn again here.

                    # Copy the original symbols file over the temp file.
                    Copy-Item -LiteralPath $originalSymbolsFilePath -Destination $SymbolsFilePath
                    Write-Verbose "Temp symbols file: $SymbolsFilePath"
                }

                # Invoke pdbstr.exe.
                Invoke-VstsTool -FileName $PdbStrPath -Arguments "-w -p:""$SymbolsFilePath"" -i:""$streamContentFilePath"" -s:srcsrv" -Verbose:$false 2>&1 |
                    ForEach-Object {
                        # Pdbstr.exe doesn't seem to ever write to STDERR or return a non-zero
                        # exit code. Just in case it does, log it as an error. Mainly this is
                        # just for consistency as that's what would have happened in the previous
                        # implementation that ran under the legacy PowerShell handler.
                        #
                        # It would probably be better to write an error if STDOUT matches the
                        # command usage.
                        if ($_ -is [System.Management.Automation.ErrorRecord]) {
                            Write-Error -ErrorRecord $_
                        } else {
                            Write-Verbose $_
                        }
                    }

                # Copy the temp symbols file back over the original file.
                if ($SymbolsFilePath -ne $originalSymbolsFilePath) {
                    Write-Verbose "Updating original symbols file."
                    Copy-Item -LiteralPath $SymbolsFilePath -Destination $originalSymbolsFilePath
                }
            } finally {
                # Clean up the temp symbols file.
                if ($SymbolsFilePath -ne $originalSymbolsFilePath) {
                    Write-Verbose "Deleting temp symbols file."
                    Remove-Item -LiteralPath $SymbolsFilePath
                }
            }
        } finally {
            # Clean up the temp stream content file.
            Write-Verbose "Deleting temp stream content file."
            Remove-Item -LiteralPath $streamContentFilePath
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Wrapper functions.
########################################
function Get-TempFileName {
    [System.IO.Path]::GetTempFileName()
}

function Write-AllText {
    [CmdletBinding()]
    param([string]$Path, [string]$Content)

    [System.IO.File]::WriteAllText($Path, $Content)
}
