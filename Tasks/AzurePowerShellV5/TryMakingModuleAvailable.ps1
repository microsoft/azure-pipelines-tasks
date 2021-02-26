[CmdletBinding()]
param (
    [string]
    $targetVersion,

    [string] [Parameter(Mandatory = $true)] [ValidateSet("Windows", "Linux", "Mac")]
    $platform
)

try {
    $isWin = $platform -eq "Windows"

    . (Join-Path $PSScriptRoot "Utility.ps1")
    $isHostedAgent = Test-IsHostedAgentPathPresent -isWin $isWin
 
    if (!$isHostedAgent) {
        Write-Verbose "Module path not present as expected in hosted agent, skipping step to make module available."
        $moduleSource = "privateAgent"
        return
    }

    if (!$targetVersion) {
        Write-Verbose "Latest selected, will make use of the latest available in agent as folder."
        $moduleSource = "hostedAgentFolder"
        return
    }

    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetVersion -isWin $isWin
    if (Test-Path $modulePath) {
        Write-Verbose "Az $targetVersion present at $modulePath as folder."
        $moduleSource = "hostedAgentFolder"
        return
    }

    $moduleContainerPath = Get-SavedModuleContainerPath -isWin $isWin
    $moduleZipPath = $modulePath + ".zip";
    if (Test-Path $moduleZipPath) {
        Write-Verbose "Az $targetVersion present at $moduleZipPath as zip, expanding it."
        Expand-ModuleZip -zipPath $moduleZipPath -destination $moduleContainerPath -isWin $isWin
        Write-Verbose "Zip expanded"
        $moduleSource = "hostedAgentZip"
        return
    }

    try {
        Write-Verbose "Getting versions manifest from GHRelease."
        $versionsManifest = Invoke-RestMethod -Method Get `
            -Headers @{ "Accept" = "application/vnd.github.VERSION.raw" } `
            -Uri "https://api.github.com/repos/Azure/az-ps-module-versions/contents/versions-manifest.json"
        Write-Verbose "Versions manifest downloaded."
        $downloadUrlEntity = $versionsManifest | Where-Object version -eq $targetVersion
        if ($downloadUrlEntity) {
            $downloadUrl = $downloadUrlEntity.files[0].download_url
            Write-Verbose "Downloading Az $targetVersion from GHRelease"
            (New-Object System.Net.WebClient).DownloadFile($downloadUrl, $moduleZipPath)
            Write-Verbose "Download succeeded"
            if (Test-Path $moduleZipPath) {
                Write-Verbose "Expanding Az $targetVersion downloaded at $moduleZipPath as zip."
                Expand-ModuleZip -zipPath $moduleZipPath -destination $moduleContainerPath -isWin $isWin
                Write-Verbose "Zip expanded"
                $moduleSource = "hostedAgentGHRelease"
                return
            }
        } else {
            Write-Verbose "Az $targetVersion not present in versions manifest from GHRelease"
        }
    } catch {
        Write-Verbose "Failed to download from GHRelease"
        Write-Verbose $_
    }

    Write-Verbose "Downloading Az $targetVersion from PSGallery."
    Save-Module -Path $modulePath -Name Az -RequiredVersion $targetVersion -Force -ErrorAction Stop
    $moduleSource = "hostedAgentPSGallery"
} finally {
    # Telemetry
    # moduleSource value will be privateAgent(in case of self hosted private agents), hostedAgentFolder(when a version is present as folder or
    # when latest is selected we will use the one latest available as folder), hostedAgentZip(when the module is available as a zip locally),
    # hostedAgentGHRelease(when the module zip is downloaded from our GitHub releases management), hostedAgentPSGallery(when we download from PSGallery
    # using the Save-Module cmdlet).
    $telemetryJsonContent = @{ targetAzurePs = $targetVersion; moduleSource = $moduleSource } | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=TaskHub;feature=AzurePowerShellV5]$telemetryJsonContent"
}
