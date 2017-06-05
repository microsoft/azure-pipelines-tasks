[CmdletBinding()]
param(
    [string] $symbolServiceURI,
    [string] $requestName,
    [string] $sourcePath,
    [string] $assemblyPath,
    [string] $toLowercase,
    [string] $detailedLog,
    [string] $usePat,
    [string] $expirationInDays,
    [string] $append
    )

function String-ToBoolean([string]$string)
{
    $boolVal = $false
    $unused = [bool]::TryParse($string, [ref]$boolVal) #powershell will return this value if we don't assign
    return $boolVal
}

function Is-UInt32([string]$string)
{
    $uint32Val = 0
    return [Uint32]::TryParse($string, [ref]$uint32Val)
}

Write-Host "In PublishSymbolsTask.ps1"
Write-Host "symbolServiceURI = $symbolServiceURI"
Write-Host "requestName = $requestName"
Write-Host "sourcePath = $sourcePath"
Write-Host "assemblyPath = $assemblyPath"
Write-Host "toLowercase = $toLowercase"
Write-Host "verboseLogging = $detailedLog"
Write-Host "expirationInDays = $expirationInDays"

$toLowercaseBool = String-ToBoolean($toLowercase)
$useDetailedLogging = String-ToBoolean($detailedLog)
$usePatBool = String-ToBoolean($usePat)
$appendBool = String-ToBoolean($append)

if ($toLowercaseBool)
{
    $requestName = $requestName.ToLower();
}

$scriptPath = "$PSScriptRoot\Publish-Symbols.ps1"
$args = " -SymbolServiceURI `"$symbolServiceURI`" -RequestName `"$requestName`" -SourcePath `"$sourcePath`""

if ($assemblyPath)
{
    $args += " -AssemblyPath `"$assemblyPath`""
}

if (Is-UInt32($expirationInDays))
{
    $args += " -ExpirationInDays `"$expirationInDays`""
}

if ($appendBool)
{
    $args += " -Append"
}

$personalAccessToken = $null
if($usePatBool)
{
    # Import the Task.Internal dll that has all the cmdlets we need for Build
    import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
    import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"

    Write-Verbose "Getting the connection object"
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Write-Verbose "Getting Personal Access Token for the Run"
    $vssEndPoint = Get-ServiceEndPoint -Context $distributedTaskContext -Name "SystemVssConnection"
    $personalAccessToken = $vssEndpoint.Authorization.Parameters.AccessToken

    if ( [string]::IsNullOrEmpty($personalAccessToken))
    {
        Write-Output "##vso[task.logissue type=error;code=001002;]"
        throw (Get-LocalizedString -Key "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator")
    }

    $args += " -personalAccessToken $personalAccessToken"
}

if($useDetailedLogging)
{
    $args += " -Verbose"
}

$publishSymbolCommand = "$scriptPath $args"
$printCommand = $publishSymbolCommand
if($personalAccessToken)
{
    $printCommand = $publishSymbolCommand.Replace($personalAccessToken, "*****") 
}

Write-Output "To invoke command: $printCommand"

Invoke-Expression -Command $publishSymbolCommand
$exitcode = $lastexitcode

# this causes the build task to actually fail
if ($exitcode -ne 0)
{
   Write-Error "Recieved non 0 exit code $exitcode"
}
exit $exitcode
