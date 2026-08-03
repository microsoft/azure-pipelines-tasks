# Description: Builds the list of task binaries (.dll/.exe) already signed by Microsoft, so the
# 3rd-party signing pass can skip them and nothing gets double-signed. node_modules is scanned only when -IncludeNodeModules is set.
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

$microsoftSignedFiles = New-Object Collections.Generic.List[String]
$filesCounter = 0
foreach ($tree in Get-ChildItem -Path $tasksRootFullPath -Include "*.dll", "*.exe" -Recurse |
    Where-Object { $IncludeNodeModules -or $_.FullName -notmatch '\\node_modules\\' } | Select-Object FullName) {
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
            $relativePath = [System.IO.Path]::GetRelativePath($tasksRootFullPath, $tree.FullName)
            $microsoftSignedFiles.Add($relativePath)
            Write-Host "Preserve (embedded Microsoft) - $relativePath"
        }
    } catch {
        $Error.Clear()
    }
}

$outputDir = Split-Path -Path $ListFilePath -Parent
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Set-Content -LiteralPath $ListFilePath -Value $microsoftSignedFiles -Encoding UTF8

Write-Host "Scanned files - $filesCounter"
Write-Host "Microsoft-signed files - $($microsoftSignedFiles.Count)"
Write-Host "List written to - $ListFilePath"
