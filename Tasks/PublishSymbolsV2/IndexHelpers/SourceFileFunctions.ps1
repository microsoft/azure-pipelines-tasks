function Get-SourceFilePaths {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SymbolsFilePath,
        [Parameter(Mandatory = $true)]
        [string]$SourcesRootPath,
        [switch]$TreatNotIndexedAsWarning
    )

    Trace-VstsEnteringInvocation $MyInvocation -Parameter SymbolsFilePath

    # Get the referenced source file paths.
    $sourceFilePaths = @(Get-DbghelpSourceFilePaths -SymbolsFilePath $SymbolsFilePath)
    if (!$sourceFilePaths.Count) {
        # Warn if no source file paths were contained in the PDB file.
        [string]$message = Get-VstsLocString -Key NoSourcePathsIn0 -ArgumentList $SymbolsFilePath
        if ($TreatNotIndexedAsWarning) {
            Write-Warning $message
        } else {
            Write-Host $message
        }

        return
    }

    # Make the sources root path end with a trailing slash.
    $SourcesRootPath = $SourcesRootPath.TrimEnd('\')
    $SourcesRootPath = "$SourcesRootPath\"

    $notUnderSourcesRootPaths = New-Object System.Collections.Generic.List[string]
    $notFoundPaths = New-Object System.Collections.Generic.List[string]
    $foundPaths = New-Object System.Collections.Generic.List[string]
    foreach ($sourceFilePath in $sourceFilePaths) {
        $sourceFilePath = $sourceFilePath.Trim()
        if (!$sourceFilePath.StartsWith($SourcesRootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            # The source file path is not under sources root.
            $notUnderSourcesRootPaths.Add($sourceFilePath)
        } else {

            $found = $false;
            try {
                $found = Test-Path -LiteralPath $sourceFilePath -PathType Leaf    
            }
            catch [System.ArgumentException] { # Path contains invalid characters
                Write-Verbose "Skipping source path containing invalid characters: $sourceFilePath"
                $found = $false;
            }

            if (!$found) {
                # The source file does not exist.
                $notFoundPaths.Add($sourceFilePath)
            } else {
                # The source file was found.
                $foundPaths.Add($sourceFilePath)
            }
        }
    }

    # Warn if issues.
    if ($notUnderSourcesRootPaths.Count -or $notFoundPaths.Count) {
        [string]$message = Get-VstsLocString -Key OneOrMoreSourceFilesNotIndexedFor0 -ArgumentList $SymbolsFilePath
        if ($TreatNotIndexedAsWarning) {
            Write-Warning $message
        } else  {
            Write-Host $message
        }

        if ($notUnderSourcesRootPaths.Count) {
            Write-Verbose "One or more source files not under sources root directory: $SourcesRootPath"
            Trace-VstsPath -Path $notUnderSourcesRootPaths
        }

        if ($notFoundPaths.Count) {
            Write-Verbose "One or more source files not found."
            Trace-VstsPath -Path $notFoundPaths
        }
    }

    Write-Verbose "Found source files:"
    Trace-VstsPath $foundPaths
    $foundPaths
    Trace-VstsLeavingInvocation $MyInvocation
}
