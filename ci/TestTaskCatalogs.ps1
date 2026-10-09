[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TasksRoot
)

$ErrorActionPreference = 'Stop'

$tasksRootPath = (Resolve-Path -LiteralPath $TasksRoot).Path
$taskDirectories = @(
    Get-ChildItem -LiteralPath $tasksRootPath -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'node_modules') }
)

foreach ($taskDirectory in $taskDirectories) {
    $nodeModulesPath = Join-Path $taskDirectory.FullName 'node_modules'
    $catalogPath = Join-Path $taskDirectory.FullName 'node_modules.cat'

    if (-not (Test-Path -LiteralPath $catalogPath)) {
        throw "Catalog not found for task '$($taskDirectory.Name)': $catalogPath"
    }

    $signature = Get-AuthenticodeSignature -LiteralPath $catalogPath
    if ($signature.Status -ne 'Valid') {
        throw "Catalog signature is not valid for task '$($taskDirectory.Name)': $($signature.StatusMessage)"
    }

    $catalogResult = Test-FileCatalog -Path $nodeModulesPath -CatalogFilePath $catalogPath
    if ($catalogResult -ne 'Valid') {
        throw "Catalog contents do not match node_modules for task '$($taskDirectory.Name)': $catalogResult"
    }

    Write-Host "Verified node_modules catalog for $($taskDirectory.Name)."
}

Write-Host "Verified $($taskDirectories.Count) node_modules catalog(s)."
