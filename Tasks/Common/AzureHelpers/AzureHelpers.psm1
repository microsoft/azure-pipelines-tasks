# Override the DebugPreference.
if ($global:DebugPreference -eq 'Continue') {
    Write-Verbose '$OVERRIDING $global:DebugPreference from ''Continue'' to ''SilentlyContinue''.'
    $global:DebugPreference = 'SilentlyContinue'
}

Import-VstsLocStrings -LiteralPath $PSScriptRoot\module.json
. $PSScriptRoot\PrivateFunctions.ps1
. $PSScriptRoot\PublicFunctions.ps1
Export-ModuleMember -Function Initialize-Azure