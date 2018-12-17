Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

$keepSessionLoggedIn = Get-VstsInput -Name KeepSessionLoggedIn

if ($__vstsAzPSInlineScriptPath -and (Test-Path -LiteralPath $__vstsAzPSInlineScriptPath) ) {
    Remove-Item -LiteralPath $__vstsAzPSInlineScriptPath -ErrorAction 'SilentlyContinue'
}

Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_

if($keepSessionLoggedIn -eq $false)
{
    Disconnect-AzureRmAccount
}

Remove-EndpointSecrets