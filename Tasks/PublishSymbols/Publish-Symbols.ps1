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

    [Parameter(Mandatory=$false)]
    [string] $ExpirationInDays,

    [Parameter(Mandatory=$false)]
    [string] $PersonalAccessToken
)

# -----------------------------------------------------------------------------
# Methods
# -----------------------------------------------------------------------------
function Download-SymbolClient([string]$symbolServiceUri, [string]$directory)
{
    $clientFetchUrl = $symbolServiceUri + "/_apis/symbol/client/exe" # Replace with symbol/client/task after M118 gets deployed

    "Downloading $($clientFetchUrl) to $($directory)" | Write-Verbose

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
        
        if ($_.Exception.Response.StatusCode -eq 404)
        {
            throw "The VSTS Symbol Server feature is not enabled for this account. See https://go.microsoft.com/fwlink/?linkid=846265 for instructions on how to enable it.`n`n "
        }
        
        throw  $_
    }
    $versionHeader = $versionResponse.Headers["symbol-client-version"]

    "Most recent version is $($versionHeader)" | Write-Verbose

    return $versionHeader
}

function Publish-Symbols([string]$symbolServiceUri, [string]$requestName, [string]$sourcePath, [string]$expirationInDays, [string]$personalAccessToken)
{
    "Using endpoint $($symbolServiceUri) to create request $($requestName) with content in $($sourcePath)" | Write-Verbose

    # the latest symbol.app.buildtask.zip and use the assemblies in it.
    $assemblyPath = Update-SymbolClient $SymbolServiceUri $env:Temp

    # Publish the files
    try
    {
        if ( $sourcePath ) 
        { 
            $sourcePath = $sourcePath.TrimEnd("\")
            "Removing trailing '\' in SourcePath. New value: $($sourcePath)" | Write-Verbose
        }
    
        $args = "publish --service `"$symbolServiceUri`" --name `"$requestName`" --directory `"$sourcePath`"" 

        if ( $expirationInDays )
        {
             $args  += " --expirationInDays `"$expirationInDays`""
        }

        if ( $personalAccessToken )
        {
             $args  += " --patAuth `"$personalAccessToken`""
        }
        else
        {
             $args += " --aadAuth"
        }

        $publishResult = Run-SymbolCommand $assemblyPath $args

        if ( $publishResult )
        {
            "Service assigned request ID: $($publishResult.Id)" | Write-Host
            "Request will automatically expire on $($publishResult.ExpirationDate) unless manually extended." | Write-Host
            return $publishResult.Id
        }
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
}

function Run-SymbolCommand([string]$assemblyPath, [string]$arguments)
{
    # Require tracelevel verbose to get JSON output
    $qarg = ""
    if ($arguments.EndsWith("-q"))
    {
        $qarg = "-q"
        $arguments = $arguments.Substring(0, $arguments.Length - 2)
    }

    $exe = "$assemblyPath\symbol.exe"
    $arguments += " --tracelevel verbose " + $qarg

    $displayArgs = $arguments | ForEach-Object { $_ -replace "--patAuth [^ ]+","--patAuth (auth)" }
    Write-Host "Running: $exe $displayArgs"

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $exe
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.Arguments = $arguments

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
   
    $process.Start() | Out-Null

    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()

    $process.WaitForExit()

    $stdout = $stdout | ForEach-Object { $_.Replace($arguments, $displayArgs) }

    if ( $process.ExitCode -ne 0 )
    {
        Write-Host $stdout

        $script:exitcode = $process.ExitCode
        Write-Host -foregroundcolor red "ERROR: $exe exited with exit code " $process.ExitCode
        if ($stderr) 
        {
            Write-Error "ERROR: $stderr"
        }
        throw "Failed to publish symbols"
    }
    else 
    {
        $stdout | Write-Verbose
    }

    if ( $stderr )
    {
        Write-Host -foregroundcolor red "ERROR: $stderr"
    }

    "$exe exited with exit code $($process.ExitCode)" | Write-Host

    # Capture and convert JSON from stdout to make it look like we actually use the API
    $stdout | where { $_ -match "({.+})" } | foreach { $matches[0] } | ConvertFrom-Json
}

function Unzip-SymbolClient([string]$clientZip, [string]$destinationDirectory)
{
    "Unzipping $($clientZip)" | Write-Verbose

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($clientZip, $destinationDirectory)

    "Unzipped" | Write-Verbose
}

function Update-SymbolClient([string]$symbolServiceUri, [string]$symbolClientLocation)
{
    "Checking for most recent symbol.app.buildtask.zip version" | Write-Verbose

    # Check latest package version.
    $availableVersion = Get-SymbolClientVersion $symbolServiceUri

    $clientPath = Join-Path $env:Temp $availableVersion
    $symbolClientZip = Join-Path $clientPath "symbol.app.buildtask.zip"

    if ( ! $(Test-Path $symbolClientZip -PathType Leaf) )
    {
        "$($symbolClientZip) not found" | Write-Verbose

        if ( $(Test-Path $clientPath -PathType Container) )
        {
            "Cleaning $($clientPath)" | Write-Verbose

            Remove-Item "$($clientPath)" -recurse | Write-Verbose
        }

        "Creating $($clientPath)" | Write-Verbose

        New-Item -ItemType directory -Path $clientPath | Write-Verbose

        $symbolClientZip = Download-SymbolClient $symbolServiceUri $clientPath
    }
    else
    {
        "$($symbolClientZip) exists" | Write-Verbose
    }

    $modulePath = Join-Path $clientPath "lib\net45"

    if ( ! $(Test-Path $modulePath -PathType Container) )
    {
        Unzip-SymbolClient $symbolClientZip $clientPath | Write-Host
    }
    else
    {
        "$($symbolClientZip) already unzipped" | Write-Verbose
    }

    "Update complete" | Write-Verbose

    return $modulePath
}

# -----------------------------------------------------------------------------
# Main logic
# -----------------------------------------------------------------------------
$Verbose=if ($PSBoundParameters.Verbose -eq $true) { $true } else { $false }

# Publish the symbols
$publishedRequestId = Publish-Symbols $SymbolServiceUri $requestName $sourcePath $ExpirationInDays $PersonalAccessToken

if ( $publishedRequestId )
{
    "Request $($requestName) successfully published and assigned ID '$($publishedRequestId)'" | Write-Host
    exit 0
}
else
{
    # CONSIDER: Cleanup partially published requests?
    "Failed to published request $($requestName)" | Write-Error

    [int]$exitCode = $lastexitcode

    # Ensure build task fails even if $lastExitCode is null or 0
    if ($exitCode -eq 0) { $exitCode = 1 }

    exit $exitCode
}
