[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] [Parameter(Mandatory = $true)] [ValidateSet("Windows", "Linux")]
    $platform
)

$latest = 'latest'

if (!$targetAzurePs) {
    $targetAzurePs = $latest;
}

if ($platform -eq "Windows") {
    . "$PSScriptRoot\Utility.ps1"
    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs
} else {
    . "$PSScriptRoot/Utility.ps1"
    $modulePath = Get-SavedModulePathLinux -azurePowerShellVersion $targetAzurePs
}

if ($targetAzurePs -eq $latest) {
    Write-Host "Downloading module Az $targetAzurePs to [$modulePath]"
    $stime = Get-Date -DisplayHint Time
    Save-Module -Path $modulePath -Name Az -Force -ErrorAction Stop
    Write-Host "Time taken to download " + ((Get-Date -DisplayHint Time) - $stime).TotalSeconds + " seconds"
    $targetAzurePs = Split-Path -Path (Join-Path -Path $modulePath -ChildPath "Az/*") -Leaf -Resolve
    Rename-Item -Path $modulePath -NewName "az_$targetAzurePs"
    Write-Host "Renamed [$modulePath] to az_$targetAzurePs"
} else {
    Write-Host "Downloading module Az $targetAzurePs to [$modulePath]"
    $stime = Get-Date -DisplayHint Time
    Save-Module -Path $modulePath -Name Az -RequiredVersion $targetAzurePs -Force -ErrorAction Stop
    Write-Host "Time taken to download " + ((Get-Date -DisplayHint Time) - $stime).TotalSeconds + " seconds"
}