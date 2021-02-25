[CmdletBinding()]
param (
    [string]
    $targetVersion
)

. "$PSScriptRoot\Utility.ps1"
$moduleContainerPath = Get-SavedModuleContainerPath

if (-not(Test-Path -Path $moduleContainerPath)) {
    Write-Verbose "Folder layout not as per hosted agent, considering self hosted agent skipping module unzip logic."
    return;
}

if (!$targetVersion) {
    Write-Verbose "Latest module selected which will be available as folder."
    return;
}

# value for classic
@($false, $true).ForEach({
    $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetVersion -Classic:$_;
    if (Test-Path -Path $modulePath) {
        Write-Verbose "Module available as folder at $modulePath"
        return;
    }

    $moduleZipPath = $modulePath + ".zip";
    if (-not(Test-Path -Path $moduleZipPath)) {
        Write-Verbose "Module zip not available to unzip at $moduleZipPath"
        return;
    }

    Write-Verbose "Extracting zip $moduleZipPath"
    $parameter = @("x", "-o$moduleContainerPath", "$moduleZipPath")
    $command = "$PSScriptRoot\7zip\7z.exe"
    &$command @parameter
    Write-Verbose "Extraction complete"
})
