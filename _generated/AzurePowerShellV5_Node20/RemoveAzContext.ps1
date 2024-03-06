. "$PSScriptRoot/Utility.ps1"
. "$PSScriptRoot/ps_modules/VstsAzureHelpers_/Utility.ps1"

Update-PSModulePathForHostedAgentLinux
Disconnect-AzureAndClearContext -restrictContext 'True'