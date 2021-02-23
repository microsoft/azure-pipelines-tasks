[CmdletBinding()]
param (
    [string]
    $targetVersion,

    [string] [Parameter(Mandatory = $true)] [ValidateSet("Windows", "Linux", "Mac")]
    $platform
)

$isWin = $platform -eq "Windows"
if ($isWin) {
    . "$PSScriptRoot\Utility.ps1"
    $isHostedAgent = Test-IsHostedAgentPathPresent
} else {
    . "$PSScriptRoot/Utility.ps1"
    $isHostedAgent = Test-IsHostedAgentPathPresentLinux
}

if (!$isHostedAgent) {
    return;
}

if (!$targetVersion) {
    return;
}

if ($isWin) {
    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetVersion
} else {
    $modulePath = Get-SavedModulePathLinux -azurePowerShellVersion $targetVersion
}

if (Test-Path $modulePath) {
    return;
}

if ($isWin) {
    $moduleContainerPath = Get-SavedModuleContainerPath
} else {
    $moduleContainerPath = Get-SavedModuleContainerPathLinux
}


$moduleZipPath = $modulePath + ".zip";
if (Test-Path $moduleZipPath) {
    Expand-ModuleZip -zipPath $moduleZipPath -destination $moduleContainerPath -isWin $isWin
    return;
}

try {
    $versionsManifest = Invoke-RestMethod -Method Get `
        -Headers @{ "Accept" = "application/vnd.github.VERSION.raw" } `
        -Uri "https://api.github.com/repos/amit-avit/az-ps-module-versions/contents/versions-manifest.json"
    $downloadUrl = ($versionsManifest | Where-Object version -eq $targetVersion).files[0].download_url
    (New-Object System.Net.WebClient).DownloadFile($downloadUrl, $moduleZipPath)
    if (Test-Path $moduleZipPath) {
        Expand-ModuleZip -zipPath $moduleZipPath -destination $moduleContainerPath -isWin $isWin
        return;
    }
} catch {

}

Save-Module -Path $modulePath -Name Az -RequiredVersion $targetVersion -Force -ErrorAction Stop
