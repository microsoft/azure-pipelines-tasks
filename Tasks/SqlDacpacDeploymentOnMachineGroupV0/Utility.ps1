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

function Should-UseSanitizedArguments {
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
        Write-Verbose "SQL argument sanitization disabled: Org-level feature flag not enabled"
        return $false
    }
    
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
        Write-Verbose "SQL argument sanitization disabled: Pipeline-level feature flag not enabled"
        return $false
    }
    
    Write-Verbose "SQL argument sanitization ENABLED (both feature flags are active)"
    return $true
}

function Get-SanitizedSqlArguments {
    param(
        [Parameter(Mandatory=$false)]
        [ValidateNotNull()]
        [string]$InputArgs = "",
        
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]$TaskName
    )
    
    if ([string]::IsNullOrWhiteSpace($InputArgs)) {
        return ""
    }
    
    if (-not (Should-UseSanitizedArguments)) {
        Write-Verbose "Returning unsanitized arguments (feature flags disabled)"
        return $InputArgs
    }
    
    try {
        $sanitizedArray = Protect-ScriptArguments -InputArgs $InputArgs -TaskName $TaskName
        
        if ($null -eq $sanitizedArray) {
            throw "Protect-ScriptArguments returned null instead of string array"
        }
        if ($sanitizedArray -isnot [Array]) {
            throw "Protect-ScriptArguments returned unexpected type: $($sanitizedArray.GetType().FullName)"
        }
        if ($sanitizedArray.Count -eq 0) {
            throw "Protect-ScriptArguments returned empty array - all input was blocked"
        }
        
        $sanitizedString = $sanitizedArray -join " "
        
        if ($sanitizedString -ne $InputArgs) {
            Write-Warning "SQL arguments were sanitized. Potentially dangerous characters were removed."
            
            $telemetryData = @{
                taskName = $TaskName
                sanitizationApplied = $true
                inputLength = $InputArgs.Length
                outputLength = $sanitizedString.Length
                charactersRemoved = $InputArgs.Length - $sanitizedString.Length
            }
            $telemetryJson = $telemetryData | ConvertTo-Json -Compress
            Write-Host "##vso[telemetry.publish area=TaskHub;feature=SqlArgumentSanitization]$telemetryJson"
        }
        else {
            Write-Verbose "SQL arguments passed sanitization without modification"
        }
        
        return $sanitizedString
    }
    catch {
        $errorMessage = "SECURITY ERROR: Failed to sanitize SQL arguments. Task cannot proceed safely. Error: $_"
        Write-Error $errorMessage
        
        $telemetryData = @{
            taskName = $TaskName
            sanitizationFailed = $true
            errorMessage = $_.Exception.Message
        }
        $telemetryJson = $telemetryData | ConvertTo-Json -Compress
        Write-Host "##vso[telemetry.publish area=TaskHub;feature=SqlArgumentSanitization]$telemetryJson"
        
        throw $errorMessage
    }
}