[CmdletBinding()]
param(
    [string] $SymbolsFolder,
    [string] $SearchPattern,
    [string] $IndexSources,
    [string] $PublishSymbols,
    [string] $SymbolServerType,
    [string] $DetailedLog,
    [string] $TreatNotIndexedAsWarning,
    [string] $SymbolsMaximumWaitTime,
    [string] $SymbolsProduct,
    [string] $SymbolsVersion,
    [string] $SymbolsArtifactName,
    [string] $SymbolsPath
    )

Write-Output "SymbolsFolder = $SymbolsFolder"
Write-Output "SearchPattern = $SearchPattern"
Write-Output "IndexSources = $IndexSources"
Write-Output "PublishSymbols = $PublishSymbols"
Write-Output "SymbolServerType = $SymbolServerType"
Write-Output "DetailedLog = $DetailedLog"
Write-Output "TreatNotIndexedAsWarning = $TreatNotIndexedAsWarning"
Write-Output "SymbolsMaximumWaitTime = $SymbolsMaximumWaitTime"
Write-Output "SymbolsProduct = $SymbolsProduct"
Write-Output "SymbolsVersion = $SymbolsVersion"
Write-Output "SymbolsArtifactName = $SymbolsArtifactName"

$publishSymbolCommand = ""

Write-Output "SymbolServerType : $SymbolServerType"

if ($SymbolServerType -eq "TeamServices")
{
    # Defaults
    $symbolServiceURI = "${env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}"
    $symbolServiceURI = $symbolServiceURI -replace ".visualstudio.com",".artifacts.visualstudio.com"

    $requestName = "${env:SYSTEM_TEAMPROJECT}/${env:BUILD_BUILDNUMBER}/${env:BUILD_BUILDID}"

    Write-Output "symbolServiceURI = $symbolServiceURI"
    Write-Output "requestName  = $requestName"

    $toLowercase = $true
    $usePat = $true
    $append = $false
    
    $scriptPath = "$PSScriptRoot\PublishSymbolsTask.ps1"
    
    $args += " -symbolServiceURI `"$symbolServiceURI`""    
    $args += " -requestName `"$requestName`""
    $args += " -sourcePath `"$SymbolsFolder`""
    $args += " -toLowercase `"$toLowercase`""
    $args += " -detailedLog `"$DetailedLog`""
    $args += " -usePat `"$usePat`""
    $args += " -append `"$append`""
    
    Write-Output "Command: $scriptPath"
    Write-Output "Args: $args"

    $publishSymbolCommand = "$scriptPath $args"
}
elseif ($SymbolServerType -eq "FileShare")
{
	# VstsTask SDK requires the below variables for its execution
	$env:INPUT_SYMBOLSERVERTYPE = $SymbolServerType
	$env:INPUT_SYMBOLSFOLDER = $SymbolsFolder
	$env:INPUT_DETAILEDLOG = $DetailedLog
	$env:INPUT_SYMBOLSMAXIMUMWAITTIME = $SymbolsMaximumWaitTime
	$env:INPUT_SYMBOLSPATH = $SymbolsPath
	$env:INPUT_SEARCHPATTERN= $SearchPattern
	$env:INPUT_SYMBOLSPRODUCT = $SymbolsProduct
	$env:INPUT_SYMBOLSVERSION = $SymbolsVersion
	$env:INPUT_SYMBOLSARTIFACTNAME = $SymbolsArtifactName
	$env:INPUT_INDEXSOURCES = $IndexSources
	$env:INPUT_TREATNOTINDEXEDASWARNING = $TreatNotIndexedAsWarning

	$env:PSModulePath = $env:PSModulePath + ";" + "$PSScriptRoot\ps_modules"
	
	Import-Module VstsTaskSdk -ArgumentList @{ NonInteractive = $true } -ErrorAction Stop
	
	$VerbosePreference = 'Continue'
	$DebugPreference = 'Continue'

	Invoke-VstsTaskScript -ScriptBlock ([scriptblock]::Create(". '$PSScriptRoot\PublishSymbols.ps1'"))
}
else
{
	throw "Unknown SymbolServerType : $SymbolServerType"
}

$exitcode = 0

if ( $publishSymbolCommand )
{
    Invoke-Expression -Command $publishSymbolCommand

    $exitcode = $lastexitcode
}
    
# this causes the build task to actually fail
if ($exitcode -ne 0)
{
   Write-Error "Recieved non 0 exit code $exitcode"
}
exit $exitcode
