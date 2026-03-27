function ConvertTo-SqlCmdParameterHashtable {
    param (
        [string] $argumentString
    )

    $result = @{}
    if ([string]::IsNullOrWhiteSpace($argumentString)) {
        return $result
    }

    # Reject strings containing PowerShell injection patterns
    if ($argumentString -match '[;|&`]|\$\(') {
        throw "AdditionalArguments contains characters that are not allowed."
    }

    # Parse -ParamName Value pairs into a hashtable for safe splatting
    $pairs = [regex]::Matches($argumentString, '-(\w+)\s*("(?:[^"]*)"|\S+)?')
    foreach ($match in $pairs) {
        $paramName = $match.Groups[1].Value
        $rawValue = $match.Groups[2].Value.Trim('"')

        if ([string]::IsNullOrEmpty($rawValue)) {
            $result[$paramName] = $true
        }
        elseif ($rawValue -match '^\d+$') {
            $result[$paramName] = [int]$rawValue
        }
        else {
            $result[$paramName] = $rawValue
        }
    }

    return $result
}

function Invoke-SqlScriptsInTransaction
{
    param
    (
        [string]$serverName,
        [string]$databaseName,
        [string]$appLockName,
        [string]$sqlscriptFiles,
        [string]$authscheme,
        [System.Management.Automation.PSCredential]$sqlServerCredentials,
        [string]$additionalArguments
    )

    Import-SqlPs

    #Get Scalar Params to replace in SQL script
    $_acquireLockParam = $appLockName
    $_acquireLockMillisecondsParam = 10
    $_acquireLockMaxAttemptsParam = 3
    $_longRunningThresholdMilliSecondsParam = 10
    $_acquireLockLastNAttemptsParam = 3
    $_fileList = $sqlscriptFiles

    #Get the wrapper sql script
    $tsql = Get-Content $PSScriptRoot\ExecuteScriptsInTransaction.sql
    $tsqlString = "$tsql"

    #Splat the Arguments
    $spaltArguments = @{
        Query = $tsqlString
        ServerInstance=$serverName
        Database=$databaseName
    }

    if($authscheme -eq "sqlServerAuthentication")
    {
        if($sqlServerCredentials)
        {
            $sqlUsername = $sqlServerCredentials.Username
            $sqlPassword = $sqlServerCredentials.GetNetworkCredential().password
            $spaltArguments.Add("Username", $sqlUsername)
            $spaltArguments.Add("Password", $sqlPassword)
        }
    }

    $scriptVariables = "_acquireLockParam = '${_acquireLockParam}'", "_acquireLockMillisecondsParam = ${_acquireLockMillisecondsParam}", "_acquireLockMaxAttemptsParam = ${_acquireLockMaxAttemptsParam}", "_longRunningThresholdMilliSecondsParam = ${_longRunningThresholdMilliSecondsParam}", "_acquireLockLastNAttemptsParam = ${_acquireLockLastNAttemptsParam}", "_fileList = ${_fileList}"
    $spaltArguments.Add("Variable", $scriptVariables)
    $spaltArguments.Add("OutputSqlErrors", $true)

    # Safely parse and merge additional arguments
    $additionalParams = ConvertTo-SqlCmdParameterHashtable $additionalArguments
    foreach ($key in $additionalParams.Keys) {
        $spaltArguments[$key] = $additionalParams[$key]
    }

    #Execute the query
    Invoke-SqlCmd @spaltArguments
}

# Function to import SqlPS module & avoid directory switch
function Import-SqlPs {
    push-location
    Import-Module SqlPS -ErrorAction 'SilentlyContinue' | out-null
    pop-location
}

function EscapeSpecialChars
{
    param(
        [string]$str
    )

    return $str.Replace('`', '``').Replace('$', '`$')
}

function GetSHA256String {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$false)]
        [string] $inputString)
    
    if ($inputString) {
        $hashHandler = [System.Security.Cryptography.HashAlgorithm]::Create('sha256')
        $hash = $hashHandler.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($inputString.ToLower()))

        $hashString = [System.BitConverter]::ToString($hash)
        $hashString = $hashString.Replace('-', '').ToLower()
        return $hashString;
    }

    return ""
}