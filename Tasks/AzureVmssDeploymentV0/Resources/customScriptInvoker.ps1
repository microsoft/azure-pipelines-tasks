Param(
    [string]$zipName,
    [string]$script,
    [string]$scriptArgs,
    [string]$prefixPath,
    [switch]$useSafeExecution
)

$ErrorActionPreference = 'Stop'

$cwd = (Get-Location).Path
$filesPath = Join-Path $cwd $prefixPath

if ($zipName) {
    $zipPath = Join-Path $filesPath $zipName
    $filesPath = Join-Path $filesPath 'a'
    Write-Host "Unzipping $zipPath"
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $filesPath)
}

Push-Location $filesPath

Write-Host "Invoking command: $script $scriptArgs"

function Split-ArgumentString {
    param([string]$ArgumentString)

    $result = @()
    $current = ''
    $inQuote = $false
    $quoteChar = ''

    for ($i = 0; $i -lt $ArgumentString.Length; $i++) {
        $c = $ArgumentString[$i]

        if ($inQuote) {
            if ($c -eq $quoteChar) {
                $inQuote = $false
            }
            else {
                $current += $c
            }
        }
        elseif ($c -eq '"' -or $c -eq "'") {
            $inQuote = $true
            $quoteChar = $c
        }
        elseif ([char]::IsWhiteSpace($c)) {
            if ($current.Length -gt 0) {
                $result += $current
                $current = ''
            }
        }
        else {
            $current += $c
        }
    }

    if ($current.Length -gt 0) {
        $result += $current
    }

    return ,$result
}

if ($useSafeExecution) {
    # Safe execution opted in via the UseSafeVmssCustomScriptExecution pipeline feature
    $parsedArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($scriptArgs)) {
        $parsedArgs = Split-ArgumentString -ArgumentString $scriptArgs
    }

    $scriptBlock = [ScriptBlock]::Create($script)
    & $scriptBlock @parsedArgs
}
else {
    Invoke-Expression "$script $scriptArgs"
}