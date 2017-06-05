<#
.SYNOPSIS
Script to publish a symbol request to Artifact Store Symbol Service

.PARAMETER RequestName 
The name to give the published request.

.PARAMETER SourcePath
The root directory containing the files to be analyzed for inclusion in the request. Only valid debug files will actually be included in the published request.

.PARAMETER SymbolServiceUri
The VSTS Symbol Service to which the request should be published.

.PARAMETER AssemblyPath
A local directory path where symbol.exe can be located.  If not provided, the latest symbol.exe will be downloaded automatically.

.PARAMETER ExpirationInDays
The number of days that symbols should be retained.  If not specified, the default settings of the service will be used.

.PARAMETER PersonalAccessToken
Optional. Use the provided PAT to authenticate to the Symbol Service.  If not provided, AAD authentication will be used.

.PARAMETER Append
Optional. Allows appending to an existing, non-finalized request.

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
    [string] $PersonalAccessToken,

    [Parameter(Mandatory=$false)]
    [string] $AssemblyPath,
    
    [Parameter(Mandatory=$false)]
    [switch] $Append)

# -----------------------------------------------------------------------------
# Methods
# -----------------------------------------------------------------------------
function Download-SymbolClient([string]$symbolServiceUri, [string]$directory)
{
    $clientFetchUrl = $symbolServiceUri + "/_apis/symbol/client/exe"

    "Downloading $($clientFetchUrl) to $($directory)" | Write-Verbose

    $symbolAppZip = Join-Path $directory "symbol.app.zip"
    (New-Object System.Net.WebClient).DownloadFile($clientFetchUrl, $symbolAppZip)

    "Download complete" | Write-Verbose

    return $symbolAppZip
}

function Get-SymbolClientVersion([string]$symbolServiceUri)
{
    "Getting latest symbol.app.zip package" | Write-Verbose

    $versionUrl = $symbolServiceUri + "/_apis/symbol/client/"
    $versionResponse = Invoke-WebRequest -Uri $versionUrl -Method Head -UseDefaultCredentials -UseBasicParsing
    $versionHeader = $versionResponse.Headers["symbol-client-version"]

    "Most recent version is $($versionHeader)" | Write-Verbose

    return $versionHeader
}

function Publish-Symbols([string]$symbolServiceUri, [string]$requestName, [string]$sourcePath, [string]$expirationInDays, [string]$personalAccessToken, [bool]$append)
{
    "Using endpoint $($symbolServiceUri) to create request $($requestName) with content in $($sourcePath)" | Write-Verbose

    # Publish the files
    try
    {
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

        if ( $append )
        {
            $args += " --append"
        }

        $publishResult = Run-SymbolCommand $args

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

function Run-SymbolCommand([string]$arguments)
{
    # Require tracelevel verbose to get JSON output
    $qarg = ""
    if ($arguments.EndsWith("-q"))
    {
        $qarg = "-q"
        $arguments = $arguments.Substring(0, $arguments.Length - 2)
    }

    $arguments += " --tracelevel verbose " + $qarg
    Write-Host "Running: $exe $arguments"

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "$($AssemblyPath)\\symbol.exe"
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

    $stdout | Write-Verbose
    "$exe exited with exit code $($process.ExitCode)" | Write-Verbose

    if ( $process.ExitCode -ne 0 )
    {
        $script:exitcode = $process.ExitCode
        Write-Host -foregroundcolor red "ERROR: $exe exited with exit code " $process.ExitCode
        Write-Host  -foregroundcolor red "ERROR: $stderr"
        throw "Failed to publish symbols"
    }

    if ( $stderr )
    {
        Write-Host  -foregroundcolor red "ERROR: $stderr"
    }

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
    "Checking for most recent symbol.app.zip version" | Write-Verbose

    # Check latest package version.
    $availableVersion = Get-SymbolClientVersion $symbolServiceUri

    $clientPath = Join-Path $env:Temp $availableVersion
    $symbolClientZip = Join-Path $clientPath "symbol.app.zip"

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

# Use the given AssemblyPath if provided.  Otherwise, find (possibly downloading, possibly unzipping)
# the latest symbol.app.zip and use the assemblies in it.
if ( -not $AssemblyPath )
{
    $AssemblyPath = Update-SymbolClient $SymbolServiceUri $env:Temp
}

# Publish the symbols
$publishedRequestId = Publish-Symbols $SymbolServiceUri $requestName $sourcePath $ExpirationInDays $PersonalAccessToken $Append

if ( $publishedRequestId )
{
    "Request $($requestName) successfully published and assigned ID '$($publishedRequestId)'" | Write-Host
    exit 0
}
else
{
    # CONSIDER: Cleanup partially published requests?
    "Failed to published request $($requestName)" | Write-Error

    # Ensure build task fails even if $lastExitCode is null or 0
    $exitCode = 1

    if ( $lastexitcode )
    {
        $exitCode = $lastExitCode

        if ($exitCode -ne 0)
        {
            "Recieved non 0 exit code $exitCode" | Write-Error
        }
    }

    exit $exitCode
}
