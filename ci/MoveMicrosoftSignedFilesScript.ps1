# Description: Moves Microsoft-signed files out of the layout before 3rd-party signing (Stash) and
# back afterwards (Restore), so the 3rd-party signing step cannot re-sign them.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TasksRoot,
    [Parameter(Mandatory = $true)]
    [string]$ListFilePath,
    [Parameter(Mandatory = $true)]
    [string]$HoldingRoot,
    [Parameter(Mandatory = $true)]
    [ValidateSet('Stash', 'Restore')]
    [string]$Mode)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ListFilePath)) {
    Write-Host "Microsoft-signed list not found - nothing to $Mode"
    return
}

$movedCounter = 0
foreach ($line in Get-Content -LiteralPath $ListFilePath) {
    $relativePath = $line.Trim()
    if ($relativePath -eq "") {
        continue
    }

    if ($Mode -eq 'Stash') {
        $source = Join-Path $TasksRoot $relativePath
        $destination = Join-Path $HoldingRoot $relativePath
    } else {
        $source = Join-Path $HoldingRoot $relativePath
        $destination = Join-Path $TasksRoot $relativePath
    }

    if (-not (Test-Path -LiteralPath $source)) {
        continue
    }

    $destinationDir = Split-Path -Path $destination -Parent
    if (-not (Test-Path -LiteralPath $destinationDir)) {
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    }

    Move-Item -LiteralPath $source -Destination $destination -Force
    $movedCounter = $movedCounter + 1
}

Write-Host "$Mode complete - $movedCounter Microsoft-signed file(s) moved"
