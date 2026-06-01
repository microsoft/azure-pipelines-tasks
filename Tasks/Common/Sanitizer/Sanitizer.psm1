# Override the DebugPreference.
if ($global:DebugPreference -eq 'Continue') {
    Write-Verbose '$OVERRIDING $global:DebugPreference from ''Continue'' to ''SilentlyContinue''.'
    $global:DebugPreference = 'SilentlyContinue'
}

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

# Don't source the private functions.
. $PSScriptRoot/ArgumentsSanitizer.ps1
. $PSScriptRoot/Invoke-ScriptArgumentSanitization.ps1

# Export public functions.
Export-ModuleMember -Function Get-SanitizerFeatureFlags
Export-ModuleMember -Function Get-SanitizerCallStatus
Export-ModuleMember -Function Get-SanitizerActivateStatus
Export-ModuleMember -Function Protect-ScriptArguments
Export-ModuleMember -Function Invoke-ScriptArgumentSanitization
Export-ModuleMember -Function Test-ShouldUseSanitizer
Export-ModuleMember -Function Publish-SanitizerErrorTelemetry