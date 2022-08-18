[CmdletBinding()]
param()

# # Ad-hoc test procedure
# node make.js build --task PublishSymbols
# $env:System_Culture = "en-US"
# Import-Module .\_build\Tasks\PublishSymbols\ps_modules\VstsTaskSdk\VstsTaskSdk.psd1
# $env:Agent_HomeDirectory = "D:\Downloads\vsts-agent-win7-x64-2.117.1"
# $env:PublishSymbols_Debug = "true"
# $env:PublishSymbols_UseDbgLkg = "true"
# .\_build\Tasks\PublishSymbols\PublishSymbols.ps1

Trace-VstsEnteringInvocation $MyInvocation

$ErrorActionPreference = "Stop"
Import-Module $PSScriptRoot\ps_modules\PowershellHelpers\PowershellHelpers.psm1

function Get-SymbolServiceUri ([string]$collectionUri)
{
    $serviceDefinitionUri = "$collectionUri/_apis/servicedefinitions/locationservice2/951917ac-a960-4999-8464-e3f0aa25b381"
    $action = { Invoke-WebRequest $serviceDefinitionUri -UseBasicParsing }
    $result = Invoke-ActionWithRetries -Action $action -MaxTries 5
    if ($result.StatusCode -eq 200) {
        $locationUri = (ConvertFrom-Json $result.Content).locationMappings[0].location
        if (-not $locationUri) {
            throw "No location mappings found while querying $serviceDefinitionUri"
        }
        $locationServiceUri = "$locationUri/_apis/servicedefinitions/locationservice2/00000016-0000-8888-8000-000000000000"
        $action = { Invoke-WebRequest $locationServiceUri -UseBasicParsing }
        $result = Invoke-ActionWithRetries -Action $action -MaxTries 5
        if ($result.StatusCode -ne 200) {
            throw "Failure while querying '$locationServiceUri', returned $($result.StatusCode)"
        }
        $artifactsUri = (ConvertFrom-Json $result.Content).locationMappings[0].location
        if (-not $artifactsUri) {
            throw "No location mappings found while querying $artifactsUri"
        }
        Write-Host "Retrieved artifact service url: '$artifactsUri'"
    }
    else { # Fallback
        if ( [RegEx]::Match($collectionUri, '\.(visualstudio\.com|vsts\.me)').Success ) {
            $artifactsUri = [RegEx]::Replace($collectionUri, '\.(visualstudio\.com|vsts\.me)', '.artifacts.$1')
        }
        else {
            $artifactsUri = [RegEx]::Replace($collectionUri, '://[^/]+/([^/]+)', '://$1.artifacts.visualstudio.com')
        }
    }
    return $artifactsUri
}

try {
    # Import the localized strings.
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    # Output dependency paths
    Import-Module $PSScriptRoot\SymbolsCommon.psm1
    $debug = [System.Convert]::ToBoolean($env:PublishSymbols_Debug)
    if ($debug)
    {
        $pdbstrPath = Get-PdbstrPath
        Write-Host "Get-PdbstrPath: $pdbstrPath"
        $dbghelpPath = Get-DbghelpPath
        Write-Host "Get-DbghelpPath: $dbghelpPath"
        $symstorePath = Get-SymStorePath
        Write-Host "Get-SymStorePath: $symstorePath"
    }

    [string]$SymbolServerType = Get-VstsInput -Name 'SymbolServerType' -Default 'None'
    [bool]$DetailedLog = Get-VstsInput -Name 'DetailedLog' -AsBool
    
    if ($SymbolServerType -eq "FileShare") {
        # Get common inputs.
        [int]$SymbolsMaximumWaitTime = Get-VstsInput -Name 'SymbolsMaximumWaitTime' -Default '0' -AsInt
        [timespan]$SymbolsMaximumWaitTime = if ($SymbolsMaximumWaitTime -gt 0) { [timespan]::FromMinutes($SymbolsMaximumWaitTime) } else { [timespan]::FromHours(2) }

        # Unpublish symbols.
        if ([bool]$Delete = Get-VstsInput -Name 'Delete' -AsBool) {
            # Construct the semaphore message.
            $utcNow = (Get-Date).ToUniversalTime()
            $semaphoreMessage = "Unpublish: True, Machine: $env:ComputerName, BuildUri: $env:Build_BuildUri, BuildNumber: $env:Build_BuildNumber, RepositoryName: $env:Build_Repository_Name, RepositoryUri: $env:Build_Repository_Uri, Team Project: $env:System_TeamProject, CollectionUri: $env:System_TeamFoundationCollectionUri at $utcNow UTC"

            # Delete the symbol store transaction.
            [string]$SymbolsPath = Get-VstsInput -Name 'SymbolsPath' -Require
            [string]$TransactionId = Get-VstsInput -Name 'TransactionId' -Require

            Import-Module -Name $PSScriptRoot\PublishHelpers\PublishHelpers.psm1
            Invoke-UnpublishSymbols -Share $SymbolsPath -TransactionId $TransactionId -MaximumWaitTime $SymbolsMaximumWaitTime -SemaphoreMessage $SemaphoreMessage
            return
        }

        # Get the inputs.
        [string]$SymbolsPath = Get-VstsInput -Name 'SymbolsPath'

        if ([string]$SourceFolder = (Get-VstsInput -Name 'SourceFolder') -and
            $SourceFolder -ne (Get-VstsTaskVariable -Name 'Build.SourcesDirectory' -Require)) {
            Write-Warning (Get-VstsLocString -Key SourceFolderDeprecated0 -ArgumentList $SourceFolder)
        }

        [string]$SymbolsProduct = Get-VstsInput -Name 'SymbolsProduct' -Default (Get-VstsTaskVariable -Name 'Build.DefinitionName' -Require)
        [string]$SymbolsVersion = Get-VstsInput -Name 'SymbolsVersion' -Default (Get-VstsTaskVariable -Name 'Build.BuildNumber' -Require)
        [string]$SymbolsArtifactName = Get-VstsInput -Name 'SymbolsArtifactName'
    } elseif ($symbolServerType -eq "TeamServices") {
        [int]$SymbolExpirationInDays = Get-VstsInput -Name 'SymbolExpirationInDays' -AsInt -Default '36530'
    }

    [bool]$SkipIndexing = -not (Get-VstsInput -Name 'IndexSources' -AsBool)
    [bool]$CompressSymbols = (Get-VstsInput -Name 'CompressSymbols' -AsBool)
    [bool]$TreatNotIndexedAsWarning = Get-VstsInput -Name 'TreatNotIndexedAsWarning' -AsBool
    [string]$defaultSymbolFolder = (Get-VstsTaskVariable -Name 'Build.SourcesDirectory' -Default "")
    [string]$SymbolsFolder = Get-VstsInput -Name 'SymbolsFolder' -Default $defaultSymbolFolder

    if ( ($SymbolServerType -eq "FileShare") -or ($SymbolServerType -eq "TeamServices") -or (-not $SkipIndexing) ) {
        # Get the PDB file paths.
        [string]$SearchPattern = Get-VstsInput -Name 'SearchPattern' -Default "**\bin\**\*.pdb"
        if ($SearchPattern.Contains("`n")) {
            [string[]]$SearchPattern = $SearchPattern -split "`n"
        }
        if (-not $SymbolsFolder) { # Both SymbolsFolder and Build.SourcesDirectory are not present 
            throw "Please provide value for SymbolFolder."
        }

        $matches = @(Find-VstsMatch -DefaultRoot $SymbolsFolder -Pattern $SearchPattern)
        $fileList = $matches | Where-Object { -not ( Test-Path -LiteralPath $_ -PathType Container ) }  # Filter out directories

        Write-Host (Get-VstsLocString -Key Found0Files -ArgumentList $fileList.Count)
        
        if (-not $fileList) {
            if ($SearchPattern.Contains(';') ) {
                throw "No files found. Use newlines instead of ';' to separate search patterns."
            }
            elseif ($matches) {
                Write-Host "No files present in matchList, the match had $($matches.Count) directories"
            }
        }
    }

    # Index the sources.
    if ($SkipIndexing) {
        Write-Host (Get-VstsLocString -Key SkippingIndexing)
    } else {
        Import-Module -Name $PSScriptRoot\IndexHelpers\IndexHelpers.psm1
        $pdbFiles = $fileList | Where-Object { $_.EndsWith(".pdb", [StringComparison]::OrdinalIgnoreCase) }
        Invoke-IndexSources -SymbolsFilePaths $pdbFiles -TreatNotIndexedAsWarning:$TreatNotIndexedAsWarning
    }

    [bool]$NeedsPublishSymbols = Get-VstsInput -Name 'PublishSymbols' -Require -AsBool
    if (-not $NeedsPublishSymbols) {
        if ($SkipIndexing) {
            throw "Either IndexSources or PublishSymbols should be checked"
        }
        return
    }

    # Publish the symbols.
    if ($SymbolServerType -eq "FileShare") {
        if ($SymbolsPath) {
            # Construct the semaphore message.
            $utcNow = (Get-Date).ToUniversalTime()
            $semaphoreMessage = "Machine: $env:ComputerName, BuildUri: $env:Build_BuildUri, BuildNumber: $env:Build_BuildNumber, RepositoryName: $env:Build_Repository_Name, RepositoryUri: $env:Build_Repository_Uri, Team Project: $env:System_TeamProject, CollectionUri: $env:System_TeamFoundationCollectionUri at $utcNow UTC"

            # Publish the symbols.
            Import-Module -Name $PSScriptRoot\PublishHelpers\PublishHelpers.psm1
            Invoke-PublishSymbols -PdbFiles $fileList -Share $SymbolsPath -Product $SymbolsProduct -Version $SymbolsVersion -MaximumWaitTime $SymbolsMaximumWaitTime -ArtifactName $SymbolsArtifactName -SemaphoreMessage $semaphoreMessage -CompressSymbols:$CompressSymbols
        } else {
            Write-Verbose "SymbolsPath was not set, publish symbols step was skipped."
        }
    } elseif ($symbolServerType -eq "TeamServices") {
        [string]$RequestName = (Get-VstsTaskVariable -Name 'System.TeamProject' -Require) + "/" + 
                               (Get-VstsTaskVariable -Name 'Build.DefinitionName' -Require)  + "/" + 
                               (Get-VstsTaskVariable -Name 'Build.BuildNumber' -Require)  + "/" + 
                               (Get-VstsTaskVariable -Name 'Build.BuildId' -Require)  + "/" + 
                               ([Guid]::NewGuid().ToString()) ;

        $RequestName = $RequestName.ToLowerInvariant();

        Write-Host "Symbol Request Name = $RequestName"

        [string]$asAccountName = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.AccountName')
        [string]$PersonalAccessToken = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.PAT')
        [bool]$UseAad = (Get-VstsTaskVariable -Name 'ArtifactServices.Symbol.UseAad' -AsBool)
        [string]$IndexableFileFormats = (Get-VstsInput -Name 'IndexableFileFormats')

        if ( $asAccountName ) {
            if ( $PersonalAccessToken ) {
                if ( $UseAad ) {
                    throw "If AccountName is specified, then only one of PAT or UseAad should be present"
                }

                $variableInfo = Get-VstsTaskVariableInfo | Where-Object { $_.Name -eq "ArtifactServices.Symbol.PAT" }

                if ($variableInfo -and -not $variableInfo.Secret) {
                    throw "The PAT needs to be specified as a secret"
                }
            }
            elseif ( -not $UseAad ) {
                throw "If AccountName is specified, then either PAT or UseAad needs to be present"
            }

            [string]$SymbolServiceUri = "https://" + [System.Web.HttpUtility]::UrlEncode($asAccountName) + ".artifacts.visualstudio.com"
        }
        else {
            if ( $PersonalAccessToken -or $UseAad ) {
                throw "If PAT or UseAad is specified, then AccountName needs to be present"
            }

            [string]$SymbolServiceUri = Get-SymbolServiceUri (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require)

            $Endpoint = Get-VstsEndPoint -Name "SystemVssConnection"
            [string]$PersonalAccessToken = $Endpoint.Auth.Parameters.AccessToken

            if ( [string]::IsNullOrEmpty($PersonalAccessToken) ) {
                throw "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator"
            }
        }

        [string]$SymbolServiceUri = $SymbolServiceUri.TrimEnd('/')

        [string]$tmpFileName = [IO.Path]::GetTempFileName()
        [string]$SourcePath = Resolve-Path -LiteralPath $SymbolsFolder
        
        [IO.File]::WriteAllLines($tmpFileName, [string[]]@("# FileList under $SymbolsFolder with pattern $SearchPattern", "")) # Also Truncates any existing files
        foreach ($filename in $fileList) {
            [string]$fullFilePath = [IO.Path]::Combine($SourcePath, $filename)
            [IO.File]::AppendAllLines($tmpFileName, [string[]]@($fullFilePath))
        }

        [string] $encodedRequestName = [System.Web.HttpUtility]::UrlEncode($RequestName)
        # Use hash prefix for now to be compatible with older/current agents, RequestType is still different (than SymbolStore)
        [string] $requestUrl = "#$SymbolServiceUri/_apis/Symbol/requests?requestName=$encodedRequestName"
        Write-VstsAssociateArtifact -Name "$RequestName" -Path $requestUrl -Type "SymbolRequest" -Properties @{}

        & "$PSScriptRoot\Publish-Symbols.ps1" `
            -SymbolServiceUri $SymbolServiceUri `
            -RequestName $RequestName `
            -SourcePath $SourcePath `
            -SourcePathListFileName $tmpFileName `
            -IndexableFileFormats `"$IndexableFileFormats`" `
            -PersonalAccessToken $PersonalAccessToken `
            -ExpirationInDays $SymbolExpirationInDays `
            -DetailedLog $DetailedLog

        if (Test-Path -Path $tmpFileName) {
            del $tmpFileName
        }
    }
    else {
        throw "Unknown SymbolServerType : $SymbolServerType"
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
