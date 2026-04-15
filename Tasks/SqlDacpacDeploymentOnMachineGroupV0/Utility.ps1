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

    #Execute the query
    Invoke-Expression "Invoke-SqlCmd @spaltArguments $additionalArguments"
}

# V2: Safe Invoke-SqlCmd execution using AST Parser + splatting (no Invoke-Expression)
# Called when both feature flags are enabled via Should-UseSanitizedArguments
# AST Parser is the correct parser here because Invoke-SqlCmd is a PowerShell cmdlet.
function Invoke-SqlScriptsInTransactionV2
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

    # Parse and merge additional arguments using AST Parser
    if (-not [string]::IsNullOrWhiteSpace($additionalArguments)) {
        $tokens = $null
        $parseErrors = $null
        [void][System.Management.Automation.Language.Parser]::ParseInput(
            "cmd $additionalArguments",
            [ref]$tokens,
            [ref]$parseErrors
        )
        
        if ($parseErrors -and $parseErrors.Count -gt 0) {
            $errorMessages = $parseErrors | ForEach-Object { $_.Message }
            Write-Error "Failed to parse additional SQL arguments: $($errorMessages -join '; ')"
            throw "Invalid additional argument syntax. Arguments must be properly quoted."
        }
        
        $parsedTokens = @($tokens | 
            Where-Object { $_.Kind -ne 'EndOfInput' } | 
            Select-Object -Skip 1)
        
        for ($i = 0; $i -lt $parsedTokens.Count; $i++) {
            if ($parsedTokens[$i].Kind -eq 'Parameter') {
                # Strip leading dash and trailing colon (e.g. -OutputSqlErrors: => OutputSqlErrors)
                $paramName = $parsedTokens[$i].Text -replace '^-' -replace ':$', ''
                # Collect all values until next parameter or end (skip commas)
                $values = @()
                $j = $i + 1
                while ($j -lt $parsedTokens.Count -and $parsedTokens[$j].Kind -ne 'Parameter') {
                    if ($parsedTokens[$j].Kind -ne 'Comma') {
                        # Resolve $true/$false/$null variable tokens to actual values
                        if ($parsedTokens[$j].Kind -eq 'Variable') {
                            $varName = $parsedTokens[$j].Text -replace '^\$', ''
                            if ($varName -eq 'true') { $values += $true }
                            elseif ($varName -eq 'false') { $values += $false }
                            elseif ($varName -eq 'null') { $values += $null }
                            else { $values += $parsedTokens[$j].Text }
                        } else {
                            $val = if ($null -ne $parsedTokens[$j].Value) { $parsedTokens[$j].Value } else { $parsedTokens[$j].Text }
                            $values += $val
                        }
                    }
                    $j++
                }
                if ($values.Count -eq 0) {
                    $spaltArguments[$paramName] = $true
                } elseif ($values.Count -eq 1) {
                    $spaltArguments[$paramName] = $values[0]
                } else {
                    $spaltArguments[$paramName] = $values
                }
                $i = $j - 1
            }
        }
    }
    
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

function Publish-FeatureFlagCheckTelemetry {
    param(
        [Parameter(Mandatory=$true)]
        [string]$CheckType,
        
        [Parameter(Mandatory=$false)]
        [hashtable]$AdditionalData = @{}
    )
    
    $telemetryData = @{
        checkType = $CheckType
        agentVersion = $env:AGENT_VERSION
    }
    
    foreach ($key in $AdditionalData.Keys) {
        $telemetryData[$key] = $AdditionalData[$key]
    }
    
    $telemetryJson = $telemetryData | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=TaskHub;feature=SqlArgumentSanitizationCheck]$telemetryJson"
}

$script:_shouldUseSanitizedArgsResult = $null

function Should-UseSanitizedArguments {
    if ($null -ne $script:_shouldUseSanitizedArgsResult) {
        return $script:_shouldUseSanitizedArgsResult
    }

    $result = Get-ShouldUseSanitizedArgumentsInternal
    $script:_shouldUseSanitizedArgsResult = $result
    return $result
}

function Get-ShouldUseSanitizedArgumentsInternal {
    try {
        $orgLevelEnabled = Get-SanitizerCallStatus
    }
    catch {
        Write-Warning "Failed to check org-level sanitizer status: $_. Proceeding without sanitization."
        Publish-FeatureFlagCheckTelemetry -CheckType "OrgLevelFeatureFlag" -AdditionalData @{
            checkFailed = $true
            errorMessage = $_.Exception.Message
        }
        return $false
    }
    
    if (-not $orgLevelEnabled) {
        Write-Verbose "SQL argument sanitization disabled: 'Enable shell tasks arguments validation' is not enabled"
        return $false
    }
    
    # in case older agents miss this command, we attempt to import the module containing it and check again before giving up on sanitization
    $hasFeatureFlagCmdlet = Get-Command -Name 'Get-VstsPipelineFeature' -ErrorAction SilentlyContinue
    
    if (-not $hasFeatureFlagCmdlet) {
        Write-Warning "Get-VstsPipelineFeature cmdlet not found. Attempting to import VstsTaskSdk module..."
        
        $vstsTaskSdkPath = Join-Path $PSScriptRoot "ps_modules\VstsTaskSdk"
        try {
            if (Test-Path $vstsTaskSdkPath) {
                Import-Module $vstsTaskSdkPath -ErrorAction Stop
                Write-Verbose "Successfully imported VstsTaskSdk from: $vstsTaskSdkPath"
            }
            else {
                Import-Module VstsTaskSdk -ErrorAction Stop
                Write-Verbose "Successfully imported VstsTaskSdk from module path"
            }
            
            $hasFeatureFlagCmdlet = Get-Command -Name 'Get-VstsPipelineFeature' -ErrorAction SilentlyContinue
        }
        catch {
            Write-Warning "Failed to import VstsTaskSdk module: $_"
        }
        
        if (-not $hasFeatureFlagCmdlet) {
            Write-Warning "Get-VstsPipelineFeature cmdlet unavailable (old agent or missing module). Proceeding without sanitization."
            Publish-FeatureFlagCheckTelemetry -CheckType "PipelineLevelFeatureFlag" -AdditionalData @{
                cmdletMissing = $true
                importAttempted = $true
                errorMessage = if ($Error[0]) { $Error[0].Exception.Message } else { "Unknown" }
                attemptedPath = $vstsTaskSdkPath
                psModulePath = $env:PSModulePath
            }
            return $false
        }
    }
    
    try {
        $pipelineLevelEnabled = Get-VstsPipelineFeature -FeatureName "EnableSqlAdditionalArgumentsSanitization" -ErrorAction Stop
    }
    catch {
        Write-Warning "Pipeline-level feature flag check failed: $_. Proceeding without sanitization."
        Publish-FeatureFlagCheckTelemetry -CheckType "PipelineLevelFeatureFlag" -AdditionalData @{
            checkFailed = $true
            errorMessage = $_.Exception.Message
        }
        return $false
    }
    
    if (-not $pipelineLevelEnabled) {
        Write-Verbose "SQL argument sanitization disabled: EnableSqlAdditionalArgumentsSanitization feature flag not enabled"
        return $false
    }
    
    Write-Verbose "SQL argument sanitization ENABLED (both feature flags are active)"
    return $true
}