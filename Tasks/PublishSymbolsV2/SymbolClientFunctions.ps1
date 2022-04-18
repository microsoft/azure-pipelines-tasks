[CmdletBinding()]
param()
# -----------------------------------------------------------------------------
# Methods
# -----------------------------------------------------------------------------
Import-Module $PSScriptRoot\ps_modules\PowershellHelpers\PowershellHelpers.psm1

function Download-SymbolClient([string]$symbolServiceUri, [string]$directory)
{
    $clientFetchUrl = $symbolServiceUri + "/_apis/symbol/client/task"

    "Downloading $clientFetchUrl to $directory" | Write-Verbose

    $symbolAppZip = Join-Path $directory "symbol.app.buildtask.zip"
    $action = { (New-Object System.Net.WebClient).DownloadFile($clientFetchUrl, $symbolAppZip) }
    Invoke-ActionWithRetries -Action $action -MaxTries 5

    "Download complete" | Write-Verbose

    return $symbolAppZip
}

function Get-SymbolClientVersion([string]$symbolServiceUri)
{
    "Getting latest symbol.app.buildtask.zip package" | Write-Verbose

    $versionUrl = $symbolServiceUri + "/_apis/symbol/client/"
    try
    {
        $action = { Invoke-WebRequest -Uri $versionUrl -Method Head -UseDefaultCredentials -UseBasicParsing }
        $versionResponse = Invoke-ActionWithRetries -Action $action -MaxTries 5
    }
    catch [System.Net.WebException] 
    {
        Write-Host "StatusCode '$($_.Exception.Response.StatusCode)' returned on account $symbolServiceUri"
        
        if ($_.Exception.Response.StatusCode -eq 404) {
            throw "The Azure Artifacts Symbol Server feature is not enabled for this account. See https://go.microsoft.com/fwlink/?linkid=846265 for instructions on how to enable it.`n`n "
        }
        
        throw  $_
    }
    $versionHeader = $versionResponse.Headers["symbol-client-version"]

    "Most recent version is $versionHeader" | Write-Verbose

    return $versionHeader
}

function Run-SymbolCommand([string]$assemblyPath, [string]$arguments)
{
    $exe = "$assemblyPath\symbol.exe"
    $traceLevel = if ($DetailedLog) { "verbose" } else { "info" }
    $arguments += " --tracelevel $traceLevel --globalretrycount 2 --append"

    Invoke-VstsTool -FileName $exe -Arguments $arguments | ForEach-Object { $_.Replace($arguments, $displayArgs) }

    if ($LASTEXITCODE -ne 0) {
        throw "$exe exited with exit code $LASTEXITCODE"
    }
}

function Unzip-SymbolClient([string]$clientZip, [string]$destinationDirectory)
{
    "Unzipping $clientZip" | Write-Verbose

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($clientZip, $destinationDirectory)

    "Unzipped" | Write-Verbose
}

function Update-SymbolClient([string]$symbolServiceUri, [string]$symbolClientLocation)
{
    "Checking for most recent symbol.app.buildtask.zip version" | Write-Verbose

    # Check latest package version.
    $availableVersion = Get-SymbolClientVersion $symbolServiceUri

    $agent = Get-VstsTaskVariable -Name 'agent.version'
    if (!$agent -or (([version]'2.115.0').CompareTo([version]$agent) -ge 1)) {
        $symbolPathRoot = Join-Path $env:APPDATA "VSOSymbolClient"        
    }
    else {
        $symbolPathRoot = Join-Path (Get-VstsTaskVariable -Name 'Agent.ToolsDirectory') "VSOSymbolClient"
    }
    $clientPath = Join-Path $symbolPathRoot $availableVersion
    $completeMarkerFile = Join-Path $clientPath "symbol.app.buildtask.complete"
    $symbolClientZip = Join-Path $clientPath "symbol.app.buildtask.zip"
    $modulePath = Join-Path $clientPath "lib\net45"

    if ( ! $(Test-Path $completeMarkerFile -PathType Leaf) ) {
        "$completeMarkerFile not found" | Write-Host

        if ( $(Test-Path $clientPath -PathType Container) ) {
            "Cleaning $clientPath" | Write-Host
            Remove-Item "$clientPath" -recurse | Write-Host
        }

        "Creating $clientPath" | Write-Host
        New-Item -ItemType directory -Path $clientPath | Write-Host
        $symbolClientZip = Download-SymbolClient $symbolServiceUri $clientPath

        Unzip-SymbolClient $symbolClientZip $clientPath | Write-Host

        [IO.File]::WriteAllBytes( $completeMarkerFile, @() )

        "Update complete" | Write-Host
    }
    else {
        "$completeMarkerFile exists" | Write-Host
    }

    return $modulePath
}
