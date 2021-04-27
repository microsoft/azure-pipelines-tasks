[CmdletBinding()]
param (
    [string]
    $targetVersion
)

try {
    . "$PSScriptRoot\Utility.ps1"
    $moduleContainerPath = Get-SavedModuleContainerPath

    if (-not(Test-Path -Path $moduleContainerPath)) {
        $classicModuleSource = "privateAgent"
        $nonClassicModuleSource = "privateAgent"
        Write-Verbose "Folder layout not as per hosted agent, considering self hosted agent skipping module unzip logic."
        return;
    }

    if (!$targetVersion) {
        $classicModuleSource = "hostedAgentFolder"
        $nonClassicModuleSource = "hostedAgentFolder"
        Write-Verbose "Latest module selected which will be available as folder."
        return;
    }

    # value for classic
    @($false, $true).ForEach({
        $modulePath = Get-SavedModulePath -azurePowerShellVersion $targetVersion -Classic:$_;
        if (Test-Path -Path $modulePath) {
            if ($_) {
                $classicModuleSource = "hostedAgentFolder"
            } else {
                $nonClassicModuleSource = "hostedAgentFolder"
            }

            Write-Verbose "Module available as folder at $modulePath"
            return;
        }

        $moduleZipPath = $modulePath + ".zip";
        if (-not(Test-Path -Path $moduleZipPath)) {
            if ($_) {
                $classicModuleSource = "hostedAgentOthers"
            } else {
                $nonClassicModuleSource = "hostedAgentOthers"
            }

            Write-Verbose "Module zip not available to unzip at $moduleZipPath"
            return;
        }

        if ($_) {
            $classicModuleSource = "hostedAgentZip"
        } else {
            $nonClassicModuleSource = "hostedAgentZip"
        }

        Write-Verbose "Extracting zip $moduleZipPath"
        $parameter = @("x", "-o$moduleContainerPath", "$moduleZipPath")
        $command = "$PSScriptRoot\7zip\7z.exe"
        &$command @parameter
        Write-Verbose "Extraction complete"
    })
} finally {
    # Telemetry
    $telemetryJsonContent = @{
        targetAzurePs = $targetVersion;
        classicModuleSource = $classicModuleSource;
        nonClassicModuleSource = $nonClassicModuleSource
    } | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=TaskHub;feature=AzurePowerShellV2]$telemetryJsonContent"
}
