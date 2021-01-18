[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] [Parameter(Mandatory = $true)] [ValidateSet("Windows", "Linux")]
    $platform
)

if (!$targetAzurePs) {
    # Getting the latest version number
    $targetAzurePs = (Find-Module -Name Az).Version.ToString();
    Write-Host "Using latest Az module verion $targetAzurePs"
}

if ($platform -eq "Windows") {
    . "$PSScriptRoot\Utility.ps1"
    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs
} else {
    . "$PSScriptRoot/Utility.ps1"
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

if (Test-Path $zipModulePath) {
    Write-Host "$zipModulePath exists, expanding it."
    Expand-Archive -Path $zipModulePath -DestinationPath (Split-Path $zipModulePath)
    if (Test-Path $modulePath) {
        Write-Host "Module expanded to $modulePath and will be used."
        return;
    }
}

Write-Host "Downloading module Az $targetAzurePs to [$modulePath]"
$stime = Get-Date -DisplayHint Time
Save-Module -Path $modulePath -Name Az -RequiredVersion $targetAzurePs -Force -ErrorAction Stop
Write-Host "Time taken to download " + ((Get-Date -DisplayHint Time) - $stime).TotalSeconds + " seconds"
