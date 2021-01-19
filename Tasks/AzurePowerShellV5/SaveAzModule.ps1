[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] [Parameter(Mandatory = $true)] [ValidateSet("Windows", "Linux")]
    $platform
)

if ($platform -eq "Windows") {
    . "$PSScriptRoot\Utility.ps1"
} else {
    . "$PSScriptRoot/Utility.ps1"
}

if (!$targetAzurePs) {
    if ($platform -eq "Windows") {
        $hostedAgentAzModulePath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
    } else {
        $hostedAgentAzModulePath = Get-LatestModuleLinux -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
    }

    if ($hostedAgentAzModulePath) {
        return;
    } else {
        $targetAzurePs = (Find-Module -Name Az).Version.ToString();
        Write-Host "No module found on the agent, so using latest Az module verion $targetAzurePs"
    }
}

if ($platform -eq "Windows") {
    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs
} else {
    $modulePath = Get-SavedModulePathLinux -azurePowerShellVersion $targetAzurePs
}

if (Test-Path $modulePath) {
    Write-Host "$modulePath already exists.";
    return;
}

if ($platform -eq "Windows") {
    $zipModulePath = Get-SavedZipModulePath -azurePowerShellVersion $targetAzurePs
} else {
    $zipModulePath = Get-SavedZipModulePathLinux -azurePowerShellVersion $targetAzurePs
}

try {
    Write-Host "Getting the versions manifest to find download url from actions repo."
    $versionsManifest = Invoke-RestMethod -Method Get `
        -Headers @{ "Accept" = "application/vnd.github.VERSION.raw" } `
        -Uri "https://api.github.com/repos/amit-avit/az-ps-module-versions/contents/versions-manifest.json"
    $downloadUrl = ($versionsManifest | Where-Object version -eq $targetAzurePs).files[0].download_url
    Write-Host "Found download url $downloadUrl for module version $targetAzurePs"
    Write-Host "Starting download from $downloadUrl"
    $downloadStartTime = Get-Date;
    (New-Object System.Net.WebClient).DownloadFile($downloadUrl, $zipModulePath)
    $downloadEndTime = Get-Date;
    Write-Host "Time taken to download $(($downloadEndTime - $downloadStartTime).TotalSeconds) seconds"

    if (Test-Path $zipModulePath) {
        Write-Host "Expanding archive $zipModulePath"
        Expand-Archive -Path $zipModulePath -DestinationPath (Split-Path $zipModulePath)
        if (Test-Path $modulePath) {
            Write-Host "Module expanded to $modulePath and will be used."
            Remove-Item -Path $zipModulePath -Force
            Write-Host "Removed $zipModulePath"
            return;
        }
    }
} catch {
    Write-Host "Some error occured while downloading from actions release management"
}

Write-Host "Downloading module Az $targetAzurePs to [$modulePath] from PSGallery using Save-Module"
$downloadStartTime = Get-Date;
Save-Module -Path $modulePath -Name Az -RequiredVersion $targetAzurePs -Force -ErrorAction Stop
$downloadEndTime = Get-Date;
Write-Host "Time taken to download $(($downloadEndTime - $downloadStartTime).TotalSeconds) seconds"
