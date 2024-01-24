<#
.SYNOPSIS
Script to publish a symbol request to Artifact Store Symbol Service

.PARAMETER RequestName 
The name to give the published request.

.PARAMETER SourcePath
The root directory containing the files to be analyzed for inclusion in the request. Only valid debug files will actually be included in the published request.

.PARAMETER SymbolServiceUri
The Azure Artifacts Symbol Service to which the request should be published.

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
    [string] $IndexableFileFormats,

    [Parameter(Mandatory=$false)]
    [string] $ExpirationInDays,

    [Parameter(Mandatory=$false)]
    [string] $PersonalAccessToken,

    [Parameter(Mandatory=$false)]
    [bool] $DetailedLog
)

$ErrorActionPreference = "Stop"

. $PSScriptRoot\SymbolClientFunctions.ps1

function Publish-Symbols([string]$symbolServiceUri, [string]$requestName, [string]$sourcePath, [string]$expirationInDays, [string]$personalAccessToken)
{
    "Using endpoint $symbolServiceUri to create request $requestName with content in $sourcePath" | Write-Verbose

    $assemblyPath = $Env:VSTS_TASKVARIABLE_SYMBOLTOOL_FILE_PATH
    if (![string]::IsNullOrEmpty($assemblyPath))
    {
        $assemblyPath = Split-Path -Path $assemblyPath -Parent
    }
    else
    {
        # the latest symbol.app.buildtask.zip and use the assemblies in it.
        $assemblyPath = Update-SymbolClient $SymbolServiceUri $env:Temp
    }

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

        if ($IndexableFileFormats) {
            $args += " --indexableFileFormats `"$IndexableFileFormats`""
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

# Publish the symbols
Publish-Symbols $SymbolServiceUri $requestName $sourcePath $ExpirationInDays $PersonalAccessToken

exit $lastexitcode
