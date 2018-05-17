<#
.SYNOPSIS
Script to publish a symbol request to Artifact Store Symbol Service

.PARAMETER RequestName 
The name to give the published request.

.PARAMETER SourcePath
The root directory containing the files to be analyzed for inclusion in the request. Only valid debug files will actually be included in the published request.

.PARAMETER SymbolServiceUri
The VSTS Symbol Service to which the request should be published.

.PARAMETER ExpirationInDays
The number of days that symbols should be retained.  If not specified, the default settings of the service will be used.

.PARAMETER PersonalAccessToken
Optional. Use the provided PAT to authenticate to the Symbol Service.  If not provided, AAD authentication will be used.

.EXAMPLE
Publish-Symbols -SymbolServiceUri "https://microsoft.artifacts.visualstudio.com/defaultcollection" -RequestName $(Build.BuildNumber) -SourcePath $(Agent.BuildDirectory)\bin
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string] $SymbolServiceUri,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string] $RequestName,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string] $SourcePath,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string] $SourcePathListFileName,

    [Parameter(Mandatory=$false)]
    [string] $ExpirationInDays,

    [Parameter(Mandatory=$false)]
    [string] $PersonalAccessToken,

    [Parameter(Mandatory=$false)]
    [bool] $DetailedLog
)

$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# Methods
# -----------------------------------------------------------------------------
function Download-SymbolClient([string]$symbolServiceUri, [string]$directory)
{
    $clientFetchUrl = $symbolServiceUri + "/_apis/symbol/client/task"

    "Downloading $clientFetchUrl to $directory" | Write-Verbose

    $symbolAppZip = Join-Path $directory "symbol.app.buildtask.zip"
    (New-Object System.Net.WebClient).DownloadFile($clientFetchUrl, $symbolAppZip)

    "Download complete" | Write-Verbose

    return $symbolAppZip
}

function Get-SymbolClientVersion([string]$symbolServiceUri)
{
    "Getting latest symbol.app.buildtask.zip package" | Write-Verbose

    $versionUrl = $symbolServiceUri + "/_apis/symbol/client/"
    try
    {
        $versionResponse = Invoke-WebRequest -Uri $versionUrl -Method Head -UseDefaultCredentials -UseBasicParsing
    }
    catch [System.Net.WebException] 
    {
        Write-Host "StatusCode '$($_.Exception.Response.StatusCode)' returned on account $symbolServiceUri"
        
        if ($_.Exception.Response.StatusCode -eq 404) {
            throw "The VSTS Symbol Server feature is not enabled for this account. See https://go.microsoft.com/fwlink/?linkid=846265 for instructions on how to enable it.`n`n "
        }
        
        throw  $_
    }
    $versionHeader = $versionResponse.Headers["symbol-client-version"]

    "Most recent version is $versionHeader" | Write-Verbose

    return $versionHeader
}

function Publish-Symbols([string]$symbolServiceUri, [string]$requestName, [string]$sourcePath, [string]$expirationInDays, [string]$personalAccessToken)
{
    "Using endpoint $symbolServiceUri to create request $requestName with content in $sourcePath" | Write-Verbose

    # the latest symbol.app.buildtask.zip and use the assemblies in it.
    $assemblyPath = Update-SymbolClient $SymbolServiceUri $env:Temp

    # Publish the files
    try
    {
        if ( $sourcePath ) { 
            $sourcePath = $sourcePath.TrimEnd("\")
            "Removing trailing '\' in SourcePath. New value: $sourcePath" | Write-Verbose
        }
    
        $args = "publish --service `"$symbolServiceUri`" --name `"$requestName`" --directory `"$sourcePath`"" 

        if ( $expirationInDays ) {
             $args  += " --expirationInDays `"$expirationInDays`""
        }

        if ( $personalAccessToken ) {
            $env:SYMBOL_PAT_AUTH_TOKEN = $personalAccessToken
            $args  += " --patAuthEnvVar SYMBOL_PAT_AUTH_TOKEN"
        } else {
            $args += " --aadAuth"
        }

        if ($SourcePathListFileName) {
            $args += " --fileListFileName `"$SourcePathListFileName`""
        }

        Run-SymbolCommand $assemblyPath $args
    }
    catch [Exception]
    {
        # throw $_ here improves the error message from being
        #    Exception calling "GetResult" with "0" argument(s): <actual interesting exception>
        # to just
        #    <actual interesting exception>
        # which I find more clear
        throw  $_
    }
    finally
    {
        $env:SYMBOL_PAT_AUTH_TOKEN = ''
    }
}

function Run-SymbolCommand([string]$assemblyPath, [string]$arguments)
{
    $exe = "$assemblyPath\symbol.exe"
    $traceLevel = if ($DetailedLog) { "verbose" } else { "info" }
    $arguments += " --tracelevel $traceLevel --globalretrycount 2"

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

# Publish the symbols
Publish-Symbols $SymbolServiceUri $requestName $sourcePath $ExpirationInDays $PersonalAccessToken

exit $lastexitcode
