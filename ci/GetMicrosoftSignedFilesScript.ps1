# Description: Builds the list of task files already signed by Microsoft (binaries .dll/.exe/.node, and
# node_modules scripts .js/.ps1/.psm1/.psd1 when -IncludeNodeModules), so the 3rd-party signing pass can
# skip them and nothing gets double-signed. node_modules is scanned only when -IncludeNodeModules is set.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TasksRoot,
    [Parameter(Mandatory = $true)]
    [string]$ListFilePath,
    [switch]$IncludeNodeModules)

$ErrorActionPreference = 'Stop'

# A file is Microsoft-signed when its certificate organization is Microsoft Corporation.
$microsoftSignerPattern = 'O=Microsoft Corporation'
$tasksRootFullPath = (Resolve-Path -LiteralPath $TasksRoot).Path
$rootWithSeparator = $tasksRootFullPath.TrimEnd('\') + '\'

$microsoftSignedFiles = New-Object Collections.Generic.List[String]
$filesCounter = 0

# Binaries (.dll/.exe/.node): scan everywhere; node_modules only when requested.
$filesToScan = Get-ChildItem -Path $tasksRootFullPath -Include "*.dll", "*.exe", "*.node" -Recurse -File |
    Where-Object { $IncludeNodeModules -or $_.FullName -notmatch '\\node_modules\\' }

# Scripts (.js/.ps1/.psm1/.psd1): scan only inside node_modules, and only when node_modules is in scope.
if ($IncludeNodeModules) {
    $filesToScan += Get-ChildItem -Path $tasksRootFullPath -Include "*.js", "*.ps1", "*.psm1", "*.psd1" -Recurse -File |
        Where-Object { $_.FullName -match '\\node_modules\\' }
}

foreach ($tree in $filesToScan | Select-Object FullName) {
    $filesCounter = $filesCounter + 1
    try {
        $isMicrosoftSigned = $false
        $authSig = Get-AuthenticodeSignature -LiteralPath $tree.FullName
        # Only preserve embedded (Authenticode) Microsoft signatures; catalog sigs don't ship with the file.
        if ($authSig.Status -eq 'Valid' -and $null -ne $authSig.SignerCertificate -and $authSig.SignatureType -eq 'Authenticode') {
            if ($authSig.SignerCertificate.Subject -match $microsoftSignerPattern) {
                $isMicrosoftSigned = $true
            }
        }

        if ($isMicrosoftSigned) {
            # Windows PowerShell 5.1 (.NET Framework) lacks [System.IO.Path]::GetRelativePath,
            # so compute the relative path by stripping the tasks-root prefix.
            if (-not $tree.FullName.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) {
                throw "File '$($tree.FullName)' is not under tasks root '$tasksRootFullPath'."
            }
            $relativePath = $tree.FullName.Substring($rootWithSeparator.Length)
            $microsoftSignedFiles.Add($relativePath)
            Write-Host "Preserve (embedded Microsoft) - $relativePath"
        }
    } catch {
        # Fail hard: an incomplete preservation list would let already-Microsoft-signed files be re-signed.
        throw "Failed to build the Microsoft-signed file list for '$($tree.FullName)': $($_.Exception.Message)"
    }
}

$outputDir = Split-Path -Path $ListFilePath -Parent
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Set-Content -LiteralPath $ListFilePath -Value $microsoftSignedFiles -Encoding UTF8

# Publish the list as a pipeline artifact (job-unique name to avoid collisions across jobs).
Write-Host "##vso[artifact.upload artifactname=microsoft-signed-files-$($env:AGENT_JOBNAME)]$ListFilePath"

Write-Host "Scanned files - $filesCounter"
Write-Host "Microsoft-signed files - $($microsoftSignedFiles.Count)"
Write-Host "List written to - $ListFilePath"
