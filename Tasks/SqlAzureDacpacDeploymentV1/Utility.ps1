$modelServerName = 'yyy.database.windows.net'
function Check-ServerName {
    param([String] [Parameter(Mandatory = $true)] $serverName)

    if (-not $serverName.Contains('.')) {
        throw (Get-VstsLocString -Key "SAD_InvalidServerNameFormat" -ArgumentList $serverName, $modelServerName)
    }
}

function Get-FormattedSqlUsername {
    param(
        [String] $sqlUserName,
        [String] $serverName
    )

    if ($serverName) {
        $serverName = ($serverName -replace "tcp:" -split "," )[0]

        $serverNameSplittedArgs = $serverName.Trim().Split(".")
        if ($serverNameSplittedArgs.Length -gt 0) {
            $sqlServerFirstName = $serverNameSplittedArgs[0]
            if ((-not $sqlUsername.Trim().Contains("@" + $sqlServerFirstName)) -and $sqlUsername.Contains('@')) {
                $sqlUsername = $sqlUsername + "@" + $serverName
            }
        }
    }

    return $sqlUsername
}

function Get-Endpoint {
    param([String] [Parameter(Mandatory = $true)] $connectedServiceName)

    $serviceEndpoint = Get-VstsEndpoint -Name "$connectedServiceName"
    return $serviceEndpoint
}

function Create-AzureSqlDatabaseServerFirewallRule {
    param([String] [Parameter(Mandatory = $true)] $startIp,
        [String] [Parameter(Mandatory = $true)] $endIp,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [Object] [Parameter(Mandatory = $true)] $endpoint,
        [string] [Parameter(Mandatory = $false)] $connectedServiceNameARM)

    [HashTable]$FirewallSettings = @{}
    $firewallRuleName = [System.Guid]::NewGuid().ToString()

    Add-AzureSqlDatabaseServerFirewallRule -endpoint $endpoint -startIPAddress $startIp -endIPAddress $endIp -serverName $serverName `
        -firewallRuleName $firewallRuleName -connectedServiceNameARM $connectedServiceNameARM | Out-Null

    $FirewallSettings.IsConfigured = $true
    $FirewallSettings.RuleName = $firewallRuleName

    return $FirewallSettings
}

function Delete-AzureSqlDatabaseServerFirewallRule {
    param([String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName,
        [String] $isFirewallConfigured,
        [String] [Parameter(Mandatory = $true)] $deleteFireWallRule,
        [Object] [Parameter(Mandatory = $true)] $endpoint,
        [string] [Parameter(Mandatory = $false)] $connectedServiceNameARM)

    if ($deleteFireWallRule -eq "true" -and $isFirewallConfigured -eq "true") {
        Remove-AzureSqlDatabaseServerFirewallRule -serverName $serverName -firewallRuleName $firewallRuleName -endpoint $endpoint `
            -connectedServiceNameARM $connectedServiceNameARM
    }
}

function Get-SqlPackageCommandArguments {
    param(
        [String] $sqlpackageAction,
        [String] $authenticationType,
        [String] $sourceFile,
        [String] $targetFile,
        [String] $sourceServerName,
        [String] $sourceDatabaseName,
        [String] $targetServerName,
        [String] $targetDatabaseName,
        [String] $sourceUser,
        [String] $sourcePassword,
        [String] $targetUser,
        [String] $targetPassword,
        [String] $targetConnectionString,
        [String] $sourceConnectionString,
        [String] $publishProfile,
        [String] $outputPath,
        [String] $additionalArguments,
        [Switch] $isOutputSecure,
        [string] $token
    )

    $ErrorActionPreference = 'Stop'

    $sqlPackageOptions =
    @{
        SourceFile = "/SourceFile:";
        Action = "/Action:";
        TargetServerName = "/TargetServerName:";
        TargetDatabaseName = "/TargetDatabaseName:";
        TargetUser = "/TargetUser:";
        TargetPassword = "/TargetPassword:";
        TargetConnectionString = "/TargetConnectionString:";
        Profile = "/Profile:";
        SourceServerName = "/SourceServerName:";
        SourceDatabaseName = "/SourceDatabaseName:";
        SourceConnectionString = "/SourceConnectionString:";
        SourceUser = "/SourceUser:";
        SourcePassword = "/SourcePassword:";
        TargetFile = "/TargetFile:";
        OutputPath = "/OutputPath:";
        AccessToken = "/AccessToken:";
    }

    $sqlPackageArguments = @("$($sqlPackageOptions.Action)$sqlpackageAction")

    if ($sourceFile) {
        $sqlPackageArguments += @("$($sqlPackageOptions.SourceFile)`"$sourceFile`"")
    }

    if ($targetFile) {
        $sqlPackageArguments += @("$($sqlPackageOptions.TargetFile)`"$targetFile`"")
    }

    if ($authenticationType -eq "server") {
        if ($sourceServerName -and $sourceDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.SourceServerName)`"$sourceServerName`"",
                "$($sqlPackageOptions.SourceDatabaseName)`"$sourceDatabaseName`"")
        }

        if ($targetServerName -and $targetDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.TargetServerName)`"$targetServerName`"",
                "$($sqlPackageOptions.TargetDatabaseName)`"$targetDatabaseName`"")
        }

        $sqlUsername = ""
        $sqlPassword = ""
        if ($sourceUser -and $sourcePassword) {
            $sqlUsername = $sourceUser
            $sqlPassword = $sourcePassword
        }

        if ($targetUser -and $targetPassword) {
            $sqlUsername = $targetUser
            $sqlPassword = $targetPassword
        }

        if ($sqlUsername) {
            $sqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsername -serverName $serverName
            if (-not($sqlPassword)) {
                Write-Error (Get-VstsLocString -Key "SAD_NoPassword" -ArgumentList $sqlUserName)
            }

            if ($isOutputSecure) {
                $sqlPassword = "********"
            }
            else {
                $sqlPassword = ConvertParamToSqlSupported $sqlPassword
            }

            if ($sourceUser -and $sourcePassword) {
                $sqlPackageArguments += @("$($sqlPackageOptions.SourceUser)`"$sqlUsername`"",
                    "$($sqlPackageOptions.SourcePassword)`"$sqlPassword`"")
            }

            if ($targetUser -and $targetPassword) {
                $sqlPackageArguments += @("$($sqlPackageOptions.TargetUser)`"$sqlUsername`"",
                    "$($sqlPackageOptions.TargetPassword)`"$sqlPassword`"")
            }
        }
    }
    elseif ($authenticationType -eq "connectionString") {
        # check this for extract and export
        if ($TargetConnectionString) {
            $sqlPackageArguments += @("$($sqlPackageOptions.TargetConnectionString)`"$targetConnectionString`"")
        }
        else {
            $sqlPackageArguments += @("$($sqlPackageOptions.SourceConnectionString)`"$sourceConnectionString`"")
        }
    }
    elseif ($authenticationType -eq "aadAuthenticationPassword" -or $authenticationType -eq "aadAuthenticationIntegrated") {

        $databaseName = $targetDatabaseName
        $sqlServerName = $targetServerName

        if (-not $databaseName) {
            $databaseName = $sourceDatabaseName
        }

        if (-not $sqlServerName) {
            $sqlServerName = $sourceServerName
        }

        $connectionString = Get-AADAuthenticationConnectionString -authenticationType $authenticationType -serverName $sqlServerName -databaseName $databaseName -sqlUserName $sqlUserName -sqlPassword $sqlPassword

        if ($targetDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.TargetConnectionString)`"$connectionString`"")
        }
        else {
            $sqlPackageArguments += @("$($sqlPackageOptions.SourceConnectionString)`"$connectionString`"")
        }
    }
    elseif ($authenticationType -eq "servicePrincipal") {
        if (!($SourceServerName -or $targetServerName)) {
            throw (Get-VstsLocString -Key "SAD_NoServerSpecified")
        }

        if ($sourceServerName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.SourceServerName)`"$sourceServerName`"")
        }
        if ($sourceDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.SourceDatabaseName)`"$sourceDatabaseName`"")
        }

        if ($targetServerName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.TargetServerName)`"$targetServerName`"")
        }
        if ($targetDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.TargetDatabaseName)`"$targetDatabaseName`"")
        }

        if ($isOutputSecure) {
            $sqlPackageArguments += @("$($sqlPackageOptions.AccessToken)`"********`"")
        }
        else {
            $sqlPackageArguments += @("$($sqlPackageOptions.AccessToken)`"$token`"")
        }
    }


    if ($publishProfile) {
        # validate publish profile
        if ([System.IO.Path]::GetExtension($publishProfile) -ne ".xml") {
            Write-Error (Get-VstsLocString -Key "SAD_InvalidPublishProfile" -ArgumentList $publishProfile)
        }

        $sqlPackageArguments += @("$($sqlPackageOptions.Profile)`"$publishProfile`"")
    }

    if ($outputPath) {
        $sqlPackageArguments += @("$($sqlPackageOptions.OutputPath)`"$outputPath`"")
    }

    # not supported in Extract Export
    $defaultTimeout = 120
    if (($authenticationType -eq "server") -and -not ($sqlpackageAction -eq "Extract" -or $sqlpackageAction -eq "Export") -and -not ($additionalArguments.ToLower().Contains("/targettimeout:") -or $additionalArguments.ToLower().Contains("/tt:"))) {
        # Add Timeout of 120 Seconds
        $additionalArguments = $additionalArguments + " /TargetTimeout:$defaultTimeout"
    }

    $sqlPackageArguments += @("$additionalArguments")
    $scriptArgument = $sqlPackageArguments -join " "

    return $scriptArgument
}

function Get-AADAuthenticationConnectionString {
    param(
        [String][Parameter(Mandatory = $true)] $authenticationType,
        [String][Parameter(Mandatory = $true)] $serverName,
        [String][Parameter(Mandatory = $true)] $databaseName,
        [String] $sqlUserName,
        [String] $sqlPassword
    )

    $connectionString = "Data Source=$serverName; Initial Catalog=$databaseName; "

    if ($authenticationType -eq "aadAuthenticationPassword") {
        $connectionString += @("Authentication=Active Directory Password; UID=$sqlUserName; PWD=$sqlPassword")
    }
    else {
        $connectionString += @("Authentication=Active Directory Integrated;")
    }

    return $connectionString
}

function Execute-Command {
    param(
        [String][Parameter(Mandatory = $true)] $FileName,
        [String][Parameter(Mandatory = $true)] $Arguments
    )

    $ErrorActionPreference = 'Continue'
    Invoke-Expression "& '$FileName' --% $Arguments" 2>&1 -ErrorVariable errors | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            Write-Error $_
        }
        else {
            Write-Host $_
        }
    }

    foreach ($errorMsg in $errors) {
        Write-Error $errorMsg
    }
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
        throw  (Get-VstsLocString -Key "SAD_AzureSQLDacpacTaskFailed" -ArgumentList $LASTEXITCODE)
    }
}

# V2: Safe execution using quote-aware CLI argument splitting (no Invoke-Expression)
# Called when both feature flags are enabled via Should-UseSanitizedArguments
function Execute-CommandV2 {
    param(
        [String][Parameter(Mandatory = $true)] $FileName,
        [String][Parameter(Mandatory = $true)] $Arguments
    )

    $ErrorActionPreference = 'Continue'
    
    # Split arguments using quote-aware splitter instead of PowerShell AST Parser.
    # CLI tools like sqlpackage.exe use /Property:Value syntax with characters
    # (;, $, parentheses) that a PowerShell parser would misinterpret.
    $argArray = Split-CLIArguments $Arguments
    
    $errors = @()
    & $FileName $argArray 2>&1 | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            $errors += $_
            Write-Error $_
        }
        else {
            Write-Host $_
        }
    }

    foreach ($errorMsg in $errors) {
        Write-Error $errorMsg
    }

    $ErrorActionPreference = 'Stop'

    if ($errors.Count -gt 0) {
        throw "Execution failed. See errors above."
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw (Get-VstsLocString -Key "SAD_AzureSQLDacpacTaskFailed" -ArgumentList $LASTEXITCODE)
    }
}

# Quote-aware argument splitter for CLI tools.
# Splits on whitespace, respects double and single quotes.
# Does not apply any PowerShell grammar — ;, $, () are treated as literal characters.
function Split-CLIArguments {
    param([string]$ArgumentString)

    $args = @()
    $current = ''
    $inQuote = $false
    $quoteChar = ''

    for ($i = 0; $i -lt $ArgumentString.Length; $i++) {
        $c = $ArgumentString[$i]
        if ($inQuote) {
            if ($c -eq $quoteChar) {
                $inQuote = $false
            } else {
                $current += $c
            }
        } elseif ($c -eq '"' -or $c -eq "'") {
            $inQuote = $true
            $quoteChar = $c
        } elseif ($c -eq ' ') {
            if ($current.Length -gt 0) {
                $args += $current
                $current = ''
            }
        } else {
            $current += $c
        }
    }
    if ($current.Length -gt 0) {
        $args += $current
    }
    return ,$args
}

# Parses additional Invoke-SqlCmd arguments using PowerShell AST Parser
# and merges them into an existing splat hashtable.
# Handles -Param:$true colon-bound syntax and resolves $true/$false/$null to booleans.
function Merge-AdditionalSqlArguments {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$SplatHashtable,

        [string]$AdditionalArguments
    )

    if ([string]::IsNullOrWhiteSpace($AdditionalArguments)) {
        return
    }

    $tokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput(
        "cmd $AdditionalArguments",
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
            $paramName = $parsedTokens[$i].Text -replace '^-' -replace ':$', ''
            $values = @()
            $j = $i + 1
            while ($j -lt $parsedTokens.Count -and $parsedTokens[$j].Kind -ne 'Parameter') {
                if ($parsedTokens[$j].Kind -ne 'Comma') {
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
            if ($values.Count -eq 0) { $SplatHashtable[$paramName] = $true }
            elseif ($values.Count -eq 1) { $SplatHashtable[$paramName] = $values[0] }
            else { $SplatHashtable[$paramName] = $values }
            $i = $j - 1
        }
    }
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

function Detect-AuthenticationType {
    param(
        [String]$serverName,
        [String]$databaseName,
        [String]$sqlUsername,
        [String]$sqlPassword,
        [String]$aadSqlUsername,
        [String]$aadSqlPassword,
        [String]$connectionString
    )

    if ($serverName -and $databaseName) {
        if ($sqlUsername -and $sqlPassword) {
            $authenticationType = "server";
        }
        elseif ($aadSqlUserName -and $aadSqlPassword) {
            $authenticationType = "aadAuthenticationPassword";
        }
        else {
            $authenticationType = "aadAuthenticationIntegrated";
        }
    }
    elseif ($connectionString) {
        $authenticationType = "connectionString";
    }
    else {
        throw (Get-VstsLocString -Key "SAD_InvalidAuthenticationInputs")
    }

    return $authenticationType
}

function ConvertParamToSqlSupported {
    param([String]$param)

    $param = $param.Replace('"', '\"')

    return $param
}

function EscapeSpecialChars {
    param(
        [string]$str
    )

    return $str.Replace('`', '``').Replace('"', '`"').Replace('$', '`$')
}

# Function to import SqlPS module & avoid directory switch
function Import-Sqlps {
    Push-Location

    $modules = Get-Module -Name SQLServer -ListAvailable
    if ($modules) {
        Import-Module SQLServer -ErrorAction 'SilentlyContinue' 3>&1 | Out-Null
        Write-Verbose "Imported SQLServer PS module."
    }
    else {
        Write-Verbose "SQLServer PS module is not installed. Importing SQLPS"
        Import-Module SqlPS -ErrorAction 'SilentlyContinue' 3>&1 | Out-Null
    }

    Pop-Location
}

function CmdletHasMember {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$cmdlet,
        [Parameter(Mandatory = $true)]
        [string]$memberName)
    try {
        $hasMember = (Get-Command $cmdlet).Parameters.Keys.Contains($memberName)
        return $hasMember
    }
    catch {
        return $false;
    }
}

function GetSHA256String {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
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



