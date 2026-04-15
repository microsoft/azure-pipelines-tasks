function Assert-SqlCmdAdditionalArguments {
    param (
        [string] $arguments
    )

    if ([string]::IsNullOrWhiteSpace($arguments)) {
        return
    }

    # Block PowerShell injection operators that have no legitimate use in Invoke-Sqlcmd arguments.
    # Legitimate alternatives exist for all blocked patterns:
    #   @() -> comma-separated values;  ` (backtick) -> use quoting instead
    $blockedPatterns = @(
        @{ Pattern = ';';   Name = 'semicolon' },
        @{ Pattern = '\|';  Name = 'pipe' },
        @{ Pattern = '&';   Name = 'ampersand' },
        @{ Pattern = '`';   Name = 'backtick' },
        @{ Pattern = '\$\('; Name = 'subexpression $(' },
        @{ Pattern = '@\('; Name = 'array expression @(' },
        @{ Pattern = '\{';  Name = 'opening brace' },
        @{ Pattern = '\}';  Name = 'closing brace' }
    )

    foreach ($blocked in $blockedPatterns) {
        if ($arguments -match $blocked.Pattern) {
            throw "Additional Invoke-Sqlcmd arguments contain a forbidden character or pattern: $($blocked.Name). This is blocked to prevent command injection. Please remove the '$($blocked.Name)' from your additional arguments."
        }
    }
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

    $additionalArguments = EscapeSpecialChars $additionalArguments

    # Validate additional arguments for injection if feature flag is enabled
    $enableArgsValidation = Get-VstsPipelineFeature -FeatureName "EnableSqlAdditionalArgumentsSanitization" -ErrorAction Stop

    if ($enableArgsValidation) {
        Write-Verbose "Feature flag EnableSqlAdditionalArgumentsSanitization is enabled. Validating additional arguments."
        Assert-SqlCmdAdditionalArguments -arguments $additionalArguments
    }

    #Execute the query
    Invoke-Expression "Invoke-SqlCmd @spaltArguments $additionalArguments"  
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