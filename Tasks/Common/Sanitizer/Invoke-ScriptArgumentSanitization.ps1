# Combines the org-level "Enable shell tasks arguments validation" toggle (via
# Get-SanitizerCallStatus / AZP_75787_*) AND a per-task pipeline-level
# feature flag, then runs Protect-ScriptArguments inside a try/catch that
# routes the localized 'ScriptArgsSanitized' message back to the caller while
# swallowing unexpected errors into telemetry.
#
# Mirrors the Should-UseSanitizedArguments / Execute-CommandV2 dispatch
# pattern introduced by PR #21947 (SqlAzureDacpacDeploymentV1 /
# SqlDacpacDeploymentOnMachineGroupV0), generalised so any task can opt-in
# with one line:
#
#   Invoke-ScriptArgumentSanitization `
#       -InputArgs $scriptArguments `
#       -TaskName 'AzurePowerShellV5' `
#       -PipelineFeatureFlagName 'EnableAzurePowerShellArgumentsSanitization'
#
# When *either* feature flag is off the call is a no-op, so existing
# pipelines are unaffected. See https://aka.ms/ado/75787.

function Publish-SanitizerErrorTelemetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TaskName,

        [Parameter(Mandatory = $true)]
        [hashtable]$Telemetry
    )

    $telemetryJson = $Telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=TaskHub;feature=$TaskName]$telemetryJson"
}

function Test-ShouldUseSanitizer {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TaskName,

        [Parameter(Mandatory = $true)]
        [string]$PipelineFeatureFlagName
    )

    try {
        $orgLevelEnabled = Get-SanitizerCallStatus
    }
    catch {
        Write-Verbose "Failed to check org-level sanitizer status: $_. Skipping sanitization."
        Publish-SanitizerErrorTelemetry -TaskName $TaskName -Telemetry @{
            checkType    = 'OrgLevelFeatureFlag'
            checkFailed  = $true
            errorMessage = $_.Exception.Message
        }
        return $false
    }

    if (-not $orgLevelEnabled) {
        Write-Verbose "Argument sanitization disabled for $TaskName : 'Enable shell tasks arguments validation' is not enabled"
        return $false
    }

    if (-not (Get-Command -Name 'Get-VstsPipelineFeature' -ErrorAction SilentlyContinue)) {
        Write-Verbose "Get-VstsPipelineFeature cmdlet not available; skipping pipeline-level sanitization check for $TaskName."
        Publish-SanitizerErrorTelemetry -TaskName $TaskName -Telemetry @{
            checkType     = 'PipelineLevelFeatureFlag'
            cmdletMissing = $true
        }
        return $false
    }

    try {
        $pipelineLevelEnabled = Get-VstsPipelineFeature -FeatureName $PipelineFeatureFlagName -ErrorAction Stop
    }
    catch {
        Write-Verbose "Pipeline-level feature flag check failed for $TaskName : $_. Skipping sanitization."
        Publish-SanitizerErrorTelemetry -TaskName $TaskName -Telemetry @{
            checkType    = 'PipelineLevelFeatureFlag'
            checkFailed  = $true
            errorMessage = $_.Exception.Message
        }
        return $false
    }

    if (-not $pipelineLevelEnabled) {
        Write-Verbose "Argument sanitization disabled for $TaskName : '$PipelineFeatureFlagName' pipeline feature flag not enabled"
        return $false
    }

    return $true
}

function Invoke-ScriptArgumentSanitization {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$InputArgs,

        [Parameter(Mandatory = $true)]
        [string]$TaskName,

        [Parameter(Mandatory = $true)]
        [string]$PipelineFeatureFlagName
    )

    if (-not (Test-ShouldUseSanitizer -TaskName $TaskName -PipelineFeatureFlagName $PipelineFeatureFlagName)) {
        return
    }

    # Fail closed: ANY exception from Protect-ScriptArguments means the
    # sanitization gate did not pass cleanly, so abort the task.
    #
    # We deliberately do NOT compare the exception message to a localized
    # value to distinguish "rejection" from "unexpected crash":
    #   * Translators localize the module-level key (PS_ prefix) and the
    #     task-level key independently. fr-FR already diverges today
    #     ("coche" vs "backtick"). A string equality check on any locale
    #     where strings drift would let a sanitizer rejection slip into a
    #     "swallow into telemetry" branch and bypass the gate.
    #   * Even if the sanitizer crashed with an unrelated error, executing
    #     the un-vetted arguments is exactly the vulnerability we are guarding
    #     against. Failing closed is the safer default.
    #
    # The throw uses this module's own PS_ScriptArgsSanitized key so all
    # loc resource references in this file resolve from the module's
    # module.json (enforced by Tests/L0 General Suite).
    $sanitizerThrew = $false
    $caughtMessage  = $null
    $caughtStack    = $null
    try {
        # The dispatcher is the opt-in entry point for the relaxed validation
        # group (AzurePowerShellV2-V5, ServiceFabricPowerShellV1). They run user
        # FilePath scripts whose arguments legitimately include hashtable params,
        # so data constructors are permitted here and the AST backstop inside
        # Protect-ScriptArguments blocks any that would execute. The other group -
        # the long-standing direct callers (AzureFileCopy, PowerShell, etc.) - keep
        # the strict allow-list by not passing this switch.
        $null = Protect-ScriptArguments -InputArgs $InputArgs -TaskName $TaskName -AllowDataConstructors
    }
    catch {
        $sanitizerThrew = $true
        $caughtMessage  = $_.Exception.Message
        $caughtStack    = $_.Exception.StackTrace
    }

    if ($sanitizerThrew) {
        Publish-SanitizerErrorTelemetry -TaskName $TaskName -Telemetry @{
            sanitizerThrew  = $true
            errorMessage    = $caughtMessage
            errorStackTrace = $caughtStack
        }
        throw (Get-VstsLocString -Key 'PS_ScriptArgsSanitized')
    }
}
