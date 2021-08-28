function Invoke-IndexSources {
    [CmdletBinding()]
    param(
        [string[]]$SymbolsFilePaths,
        [string]$SourcesRootPath,
        [switch]$TreatNotIndexedAsWarning,
        [switch]$IgnoreIdxRetrievalError,
        [switch]$ResolveGitSource
    )

    Trace-VstsEnteringInvocation $MyInvocation -Parameter TreatNotIndexedAsWarning
    try {
        # Validate at least one symbols file.
        if (!$SymbolsFilePaths) {
            Write-Warning (Get-VstsLocString -Key NoFilesForIndexing);
            return
        }

        $pdbstrPath = Get-PdbstrPath

        # Warn if spaces in the temp path.
        if ("$env:TMP".Contains(' ')) {
            Write-Warning (Get-VstsLocString -Key SpacesInTemp)
            # Don't short-circuit. Just try anyway even though it will likely fail.
        }

        # For consistency with the previous implementation, set the working directory to the TEMP folder
        # (even though the temp files are created in TMP) before calling pdbstr.exe.
        Push-Location $env:TEMP
        $dbghelpModuleHandle = $null
        $provider = $null
        try {
            # Load dbghelp.dll if it is not already loaded.
            $dbghelpModuleHandle = Add-DbghelpLibrary

            # Set the provider specific information.
            if (!($provider = Get-SourceProvider -SourcesRootPath $SourcesRootPath -ResolveGitSource:$ResolveGitSource)) {
                return
            }

            # Index the source files
            foreach ($symbolsFilePath in $SymbolsFilePaths) {
                #if (!$symbolsFilePath.EndsWith('.pdb', [System.StringComparison]::OrdinalIgnoreCase)) {
                #    Write-Verbose "Skipping: $symbolsFilePath"
                #    continue
                #}

                $bytes = Get-Content $symbolsFilePath -Encoding byte -TotalCount 4
                $data = [System.Text.Encoding]::ASCII.GetString($bytes)
                if ($data.equals("BSJB")) {
                    Write-Verbose "Skipping: $symbolsFilePath because it is a Portable PDB"
                    continue
                }

                # Get the source file paths embedded in the symbols file.
                [string[]]$sourceFilePaths = Get-SourceFilePaths -SymbolsFilePath $symbolsFilePath -SourcesRootPath $provider.SourcesRootPath -TreatNotIndexedAsWarning:$TreatNotIndexedAsWarning -IgnoreIdxRetrievalError:$IgnoreIdxRetrievalError
                if (!$sourceFilePaths.Count) {
                    continue
                }

                # Get the content for the source server INI file.
                [string]$srcSrvIniContent = New-SrcSrvIniContent -Provider $provider -SourceFilePaths $sourceFilePaths

                # Add the source server info to the symbols file.
                Add-SourceServerStream -PdbStrPath $pdbstrPath -SymbolsFilePath $symbolsFilePath -StreamContent $srcSrvIniContent
            }
        } finally {
            Remove-DbghelpLibrary -HModule $dbghelpModuleHandle
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
