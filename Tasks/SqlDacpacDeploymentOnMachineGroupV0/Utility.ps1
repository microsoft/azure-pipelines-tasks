function ConvertTo-SqlCmdParameterHashtable {
    param (
        [string] $argumentString
    )

    $result = @{}
    if ([string]::IsNullOrWhiteSpace($argumentString)) {
        return $result
    }

    # Use PowerShell's built-in parser to tokenize the argument string.
    # ParseInput is a pure parser (never executes code) that correctly handles
    # quoting, comma-separated arrays, escape sequences, and all PS syntax.
    # No injection validation is needed because values are passed via splatting
    # (Invoke-Sqlcmd @params), which treats them as literals — never evaluated.
    $tokens = $null
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseInput(
        "Invoke-Sqlcmd $argumentString", [ref]$tokens, [ref]$parseErrors)

    $currentParam = $null
    $values = New-Object System.Collections.Generic.List[object]

    # Commits the current parameter and its collected values into $result.
    $flushParam = {
        if (-not $currentParam) { return }
        if ($values.Count -eq 0)     { $result[$currentParam] = $true }
        elseif ($values.Count -eq 1) { $result[$currentParam] = $values[0] }
        else                         { $result[$currentParam] = [object[]]$values.ToArray() }
    }

    for ($i = 1; $i -lt $tokens.Count; $i++) {
        $token = $tokens[$i]
        if ($token.Kind -eq 'EndOfInput') { break }

        if ($token.Kind -eq 'Parameter') {
            & $flushParam
            $currentParam = $token.ParameterName
            $values = New-Object System.Collections.Generic.List[object]
        }
        elseif ($token.Kind -ne 'Comma') {
            # Collect value tokens (skip commas which just separate array elements)
            switch ($token.Kind) {
                'Number' {
                    $values.Add($token.Value)
                }
                { $_ -in 'StringLiteral', 'StringExpandable' } {
                    $values.Add($token.Value)
                }
                'Variable' {
                    switch ($token.Name) {
                        'true'  { $values.Add($true) }
                        'false' { $values.Add($false) }
                        default { $values.Add($token.Text) }
                    }
                }
                default {
                    $values.Add($token.Text)
                }
            }
        }
    }

    & $flushParam

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