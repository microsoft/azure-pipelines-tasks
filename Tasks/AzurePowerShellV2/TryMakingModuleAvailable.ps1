[CmdletBinding()]
param (
    [string]
    $targetVersion
)

. "$PSScriptRoot\Utility.ps1"
$moduleContainerPath = Get-SavedModuleContainerPath

if (-not(Test-Path -Path $moduleContainerPath)) {
    return;
}

if (!$targetVersion) {
    return;
}

# value for classic
@($false, $true).ForEach({
    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetVersion -Classic:$_;
    if (Test-Path -Path $modulePath) {
        return;
    }

    $moduleZipPath = $modulePath + ".zip";
    if (-not(Test-Path -Path $moduleZipPath)) {
        return;
    }

    $parameter = @("x", "-o$moduleContainerPath", "$moduleZipPath")
    $command = "$PSScriptRoot\7zip\7z.exe"
    &$command @parameter
})
