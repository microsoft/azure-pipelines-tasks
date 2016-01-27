[cmdletbinding()]
param(
    [string]$Delete = 'false',
    [string]$SymbolsPath,
    [string]$SearchPattern,
    [string]$SourceFolder, # Support for sourceFolder has been Deprecated.
    [string]$SymbolsProduct,
    [string]$SymbolsVersion,
    [string]$SymbolsMaximumWaitTime,
    [string]$SymbolsFolder,
    [string]$SymbolsArtifactName,
    [string]$SkipIndexing,
    [string]$TransactionId,
    [string]$TreatNotIndexedAsWarning = 'false',
    [Parameter(ValueFromRemainingArguments = $true)]
    [object[]]$RemainingArguments)

Write-Verbose "Entering script $PSCommandPath"
$PSBoundParameters.Keys |
    ForEach-Object { Write-Verbose "$_ = $($PSBoundParameters[$_])" }

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# Convert Booleans.
[bool]$Delete = $Delete -eq 'true'
[bool]$SkipIndexing = $SkipIndexing -eq 'true'
[bool]$TreatNotIndexedAsWarning = $TreatNotIndexedAsWarning -eq 'true'

. $PSScriptRoot\LegacyIndexHelpers.ps1
. $PSScriptRoot\LegacyPublishHelpers.ps1

if ($Delete) {
    # Construct the semaphore message.
    $utcNow = (Get-Date).ToUniversalTime()
    $semaphoreMessage = "Unpublish: True, Machine: $env:ComputerName, BuildUri: $env:Build_BuildUri, BuildNumber: $env:Build_BuildNumber, RepositoryName: $env:Build_Repository_Name, RepositoryUri: $env:Build_Repository_Uri, Team Project: $env:System_TeamProject, CollectionUri: $env:System_TeamFoundationCollectionUri at $utcNow UTC"

    # Delete the symbol store transaction.
    Write-Host "Invoke-DeleteSymbols -Share $SymbolsPath -TransactionId $TransactionId"
    Invoke-UnpublishSymbols -Share $SymbolsPath -TransactionId $TransactionId -MaximumWaitTime ([timespan]::FromHours(2)) -SemaphoreMessage $semaphoreMessage
    return
}

# Warn if deprecated parameter was used.
if ($SourceFolder -and ($SourceFolder -ne $env:Build_SourcesDirectory)) {
    Write-Warning (Get-LocalizedString -Key 'The source folder parameter has been deprecated. Ignoring the value: {0}' -ArgumentList $SourceFolder)
}

# Default search pattern.
if (!$SearchPattern) {
    $SearchPattern = "**\bin\**\*.pdb"
    Write-Verbose "searchPattern not sent to script, defaulting to $SearchPattern"
}

# Default symbols product.
if (!$SymbolsProduct) {
    $SymbolsProduct = $env:Build_DefinitionName
    Write-Verbose "symbolsProduct not sent to script, defaulting to $SymbolsProduct"
}

# Default symbols verison.
if (!$SymbolsVersion) {
    $SymbolsVersion = $env:Build_BuildNumber
    Write-Verbose "symbolsVersion not sent to script, defaulting to $SymbolsVersion"
}

# Default max wait time.
$maxWaitTime = $null
if (!$SymbolsMaximumWaitTime) {
    $maxWaitTime = [timespan]::FromHours(2)
    Write-Verbose "symbolsMaximumWaitTime not sent to script, using the default maxWaitTime of 2 hours"
} elseif (![Int32]::TryParse($SymbolsMaximumWaitTime, [ref] $maxWaitTime)) {
    $maxWaitTime = [timespan]::FromHours(2)
    Write-Verbose "Could not parse symbolsMaximumWaitTime input, using the default maxWaitTime of 2 hours"
} else {
    # Convert the UI value (specified in minutes).
    $maxWaitTime = [timespan]::FromMinutes($maxWaitTime)
    Write-Verbose "Converted symbolsMaximumWaitTime parameter value of $SymbolsMaximumWaitTime minutes to $maxWaitTime"
}

Write-Verbose "maxWaitTime = $maxWaitTime"

# Default maxSemaphoreAge.
$maxSemaphoreAge = [timespan]::FromDays(1)
Write-Verbose "maxSemaphoreAge = $maxSemaphoreAge"

# Default symbols folder.
if (!$SymbolsFolder) {
    $SymbolsFolder = $env:Build_SourcesDirectory
}

# Get the PDB file paths.
Write-Host "Find-Files -SearchPattern $SearchPattern -RootFolder $SymbolsFolder"
[string[]]$pdbFiles = Find-Files -SearchPattern $SearchPattern -RootFolder $SymbolsFolder
foreach ($pdbFile in $pdbFiles) {
    Write-Verbose "pdbFile = $pdbFile"
}

Write-Host (Get-LocalizedString -Key "Found {0} symbol files to index." -ArgumentList $pdbFiles.Count)

if ($SkipIndexing) {
    Write-Host "Skipping indexing."
} else {
    # Index the sources.
    Invoke-IndexSources -SymbolsFilePaths $pdbFiles -TreatNotIndexedAsWarning:$TreatNotIndexedAsWarning
}

# Publish the symbols.
if ($SymbolsPath) {
    $utcNow = (Get-Date).ToUniversalTime()
    $semaphoreMessage = "Machine: $env:ComputerName, BuildUri: $env:Build_BuildUri, BuildNumber: $env:Build_BuildNumber, RepositoryName: $env:Build_Repository_Name, RepositoryUri: $env:Build_Repository_Uri, Team Project: $env:System_TeamProject, CollectionUri: $env:System_TeamFoundationCollectionUri at $utcNow UTC"
    Write-Verbose "semaphoreMessage = $semaphoreMessage"
    $OFS = " "
    Write-Host "Invoke-PublishSymbols -PdbFiles [...] -Share $SymbolsPath -Product $SymbolsProduct -Version $SymbolsVersion -MaximumWaitTime $($maxWaitTime.TotalMilliseconds) -MaximumSemaphoreAge $($maxSemaphoreAge.TotalMinutes) -ArtifactName $SymbolsArtifactName -SemaphoreMessage $semaphoreMessage"
    Invoke-PublishSymbols -PdbFiles $pdbFiles -Share $SymbolsPath -Product $SymbolsProduct -Version $SymbolsVersion -MaximumWaitTime $maxWaitTime.TotalMilliseconds -MaximumSemaphoreAge $maxSemaphoreAge.TotalMinutes -ArtifactName $SymbolsArtifactName -SemaphoreMessage $semaphoreMessage
} else {
    Write-Verbose "SymbolsPath was not set on script, publish symbols step was skipped."
}

Write-Verbose "Leaving script PublishSymbols.ps1"
