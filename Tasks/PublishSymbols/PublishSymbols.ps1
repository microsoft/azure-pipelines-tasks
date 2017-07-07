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

    [string]$SymbolServerType = Get-VstsInput -Name 'SymbolServerType' -Require
    
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
    }
    [bool]$SkipIndexing = -not (Get-VstsInput -Name 'IndexSources' -AsBool)
    [bool]$TreatNotIndexedAsWarning = Get-VstsInput -Name 'TreatNotIndexedAsWarning' -AsBool
    [string]$SymbolsFolder = Get-VstsInput -Name 'SymbolsFolder' -Default (Get-VstsTaskVariable -Name 'Build.SourcesDirectory' -Require)

    if ( ($SymbolServerType -eq "FileShare") -or ($SymbolServerType -eq "TeamServices") -or (-not $SkipIndexing) ) {
        # Get the PDB file paths.
        [string]$SearchPattern = Get-VstsInput -Name 'SearchPattern' -Default "**\bin\**\*.pdb"
        # $pdbFiles = @(Find-VstsFiles -LiteralDirectory $SymbolsFolder -LegacyPattern $SearchPattern)
        $pdbFiles = @(Find-VstsMatch -DefaultRoot $SymbolsFolder -Pattern $SearchPattern)
        Write-Host (Get-VstsLocString -Key Found0Files -ArgumentList $pdbFiles.Count)
        
        if (-not $pdbFiles -and $SearchPattern.Contains(';')) {
            throw "No files found. Use newlines instead of ';' to separate search patterns."
        }
    }

    # Index the sources.
    if ($SkipIndexing) {
        Write-Host (Get-VstsLocString -Key SkippingIndexing)
    } else {
        Import-Module -Name $PSScriptRoot\IndexHelpers\IndexHelpers.psm1
        Invoke-IndexSources -SymbolsFilePaths $pdbFiles -TreatNotIndexedAsWarning:$TreatNotIndexedAsWarning
    }

    # Publish the symbols.
    if ($SymbolServerType -eq "FileShare") {
        if ($SymbolsPath) {
            # Construct the semaphore message.
            $utcNow = (Get-Date).ToUniversalTime()
            $semaphoreMessage = "Machine: $env:ComputerName, BuildUri: $env:Build_BuildUri, BuildNumber: $env:Build_BuildNumber, RepositoryName: $env:Build_Repository_Name, RepositoryUri: $env:Build_Repository_Uri, Team Project: $env:System_TeamProject, CollectionUri: $env:System_TeamFoundationCollectionUri at $utcNow UTC"

            # Publish the symbols.
            Import-Module -Name $PSScriptRoot\PublishHelpers\PublishHelpers.psm1
            Invoke-PublishSymbols -PdbFiles $pdbFiles -Share $SymbolsPath -Product $SymbolsProduct -Version $SymbolsVersion -MaximumWaitTime $SymbolsMaximumWaitTime -ArtifactName $SymbolsArtifactName -SemaphoreMessage $semaphoreMessage
        } else {
            Write-Verbose "SymbolsPath was not set, publish symbols step was skipped."
        }
    }
    elseif ($symbolServerType -eq "TeamServices") {

        [string]$RequestName = (Get-VstsTaskVariable -Name 'System.TeamProject' -Require) + "/" + 
                               (Get-VstsTaskVariable -Name 'Build.DefinitionName' -Require)  + "/" + 
                               (Get-VstsTaskVariable -Name 'Build.BuildNumber' -Require)  + "/" + 
                               (Get-VstsTaskVariable -Name 'Build.BuildId' -Require)  + "/" + 
                               ([Guid]::NewGuid().ToString()) ;

        $RequestName = $RequestName.ToLowerInvariant();

        Write-Host "Symbol Request Name = $RequestName"

        [string]$SymbolServiceUri = (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require) -replace ".visualstudio.com",".artifacts.visualstudio.com"
        $SymbolServiceUri = $SymbolServiceUri.TrimEnd('/')

        $Endpoint = Get-VstsEndPoint -Name "SystemVssConnection"
        [string]$PersonalAccessToken = $Endpoint.Auth.Parameters.AccessToken

        if ( [string]::IsNullOrEmpty($PersonalAccessToken) ) {
            throw "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator"
        }

        [string]$tmpFileName = Join-Path $env:TEMP ("SymbolFileList-" + [random]::new().Next(100) + ".txt")
        [string]$SourcePath = Resolve-Path -LiteralPath $SymbolsFolder
        
        [IO.File]::WriteAllLines($tmpFileName, [string[]]@("# FileList under $SymbolsFolder with pattern $SearchPattern", "")) # Also Truncates any existing files
        foreach ($filename in $pdbFiles) {
            [string]$fullFilePath = [IO.Path]::Combine($SourcePath, $filename)
            [IO.File]::AppendAllLines($tmpFileName, [string[]]@($fullFilePath))
        }

        & "$PSScriptRoot\Publish-Symbols.ps1" -SymbolServiceUri $SymbolServiceUri -RequestName $RequestName -SourcePath $SourcePath -SourcePathListFileName $tmpFileName -PersonalAccessToken $PersonalAccessToken -ExpirationInDays 3653

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
