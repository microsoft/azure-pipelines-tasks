Import-Module "$PSScriptRoot\ps_modules\VstsTaskSdk" -ArgumentList @{ NonInteractive = $true }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot/Utility.ps1"
    . "$PSScriptRoot/ps_modules/VstsAzureHelpers_/Utility.ps1"

    Update-PSModulePathForHostedAgentLinux
    Disconnect-AzureAndClearContext -restrictContext 'True'

    if ($env:AZURESUBSCRIPTION_SERVICE_CONNECTION_ID) {
        $env:AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = ""
        $env:AZURESUBSCRIPTION_CLIENT_ID = ""
        $env:AZURESUBSCRIPTION_TENANT_ID = ""
    }
}
catch {
    Write-Host "##vso[task.logissue type=error]$($_.Exception.Message)"
    exit 1
}