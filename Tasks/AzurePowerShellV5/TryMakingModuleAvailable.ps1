[CmdletBinding()]
param (
    [string]
    $targetVersion,

    [string] [Parameter(Mandatory = $true)] [ValidateSet("Windows", "Linux", "Mac")]
    $platform
)

try {
    $isWin = $platform -eq "Windows"
    if ($isWin) {
        . "$PSScriptRoot\Utility.ps1"
        $isHostedAgent = Test-IsHostedAgentPathPresent
    } else {
        . "$PSScriptRoot/Utility.ps1"
        $isHostedAgent = Test-IsHostedAgentPathPresentLinux
    }

    if (!$isHostedAgent) {
        $moduleSource = "Others"
        return
    }

    if (!$targetVersion) {
        $moduleSource = "Folder"
        return
    }

    if ($isWin) {
        $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetVersion
    } else {
        $modulePath = Get-SavedModulePathLinux -azurePowerShellVersion $targetVersion
    }

    if (Test-Path $modulePath) {
        $moduleSource = "Folder"
        return
    }

    if ($isWin) {
        $moduleContainerPath = Get-SavedModuleContainerPath
    } else {
        $moduleContainerPath = Get-SavedModuleContainerPathLinux
    }


    $moduleZipPath = $modulePath + ".zip";
    if (Test-Path $moduleZipPath) {
        Expand-ModuleZip -zipPath $moduleZipPath -destination $moduleContainerPath -isWin $isWin
        $moduleSource = "Zip"
        return
    }

    try {
        $versionsManifest = Invoke-RestMethod -Method Get `
            -Headers @{ "Accept" = "application/vnd.github.VERSION.raw" } `
            -Uri "https://api.github.com/repos/Azure/az-ps-module-versions/contents/versions-manifest.json"
        $downloadUrl = ($versionsManifest | Where-Object version -eq $targetVersion).files[0].download_url
        (New-Object System.Net.WebClient).DownloadFile($downloadUrl, $moduleZipPath)
        if (Test-Path $moduleZipPath) {
            Expand-ModuleZip -zipPath $moduleZipPath -destination $moduleContainerPath -isWin $isWin
            $moduleSource = "GHRelease"
            return
        }
    } catch {
        Write-Verbose "Failed to download from GHRelease"
        Write-Verbose $_
    }

    Save-Module -Path $modulePath -Name Az -RequiredVersion $targetVersion -Force -ErrorAction Stop
    $moduleSource = "PSGallery"
} finally {
    # Telemetry
    $telemetryJsonContent = @{ targetAzurePs = $targetVersion; moduleSource = $moduleSource } | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=TaskHub;feature=AzurePowerShellV5]$telemetryJsonContent"
}
