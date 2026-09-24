[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

# Local-only discovery must not invoke PowerShellGet.
Register-Mock Test-IsHostedAgentPathPresent { $false }
Register-Mock Get-InstalledModule
Register-Mock Get-Module { @{ Version = [version]"12.1.0" } }

$actualVersion = Get-InstalledMajorRelease `
    -moduleName "Az" `
    -isWin $true `
    -localOnly

Assert-AreEqual "12.1.0" $actualVersion
Assert-WasCalled Get-InstalledModule -Times 0
Assert-WasCalled Get-Module -Times 1

# Feature enabled: use local-only discovery and the three-second request.
Unregister-Mock Get-VstsPipelineFeature

Register-Mock Get-VstsPipelineFeature { $true } -- `
    -FeatureName "ShowWarningOnOlderAzureModules"

Register-Mock Get-VstsPipelineFeature { $true } -- `
    -FeatureName "EnableAzureModuleVersionCheckRequestTimeout"

Register-Mock Get-InstalledMajorRelease { "12.1.0" }
Register-Mock Get-MajorVersionOnAzurePackage {
    @{ tag_name = "v13.0.0" }
}
Register-Mock Get-IsSpecifiedPwshAzVersionOlder { $false }

Initialize-ModuleVersionValidation `
    -moduleName "azure-powershell" `
    -targetAzurePs "" `
    -displayModuleName "Az" `
    -versionsToReduce 3

Assert-WasCalled Get-InstalledMajorRelease -ParametersEvaluator {
    $moduleName -eq "Az" -and $isWin -and $localOnly
}

Assert-WasCalled Get-MajorVersionOnAzurePackage -ParametersEvaluator {
    $moduleName -eq "azure-powershell" -and
    $requestTimeoutSeconds -eq 3
}

# Feature disabled: preserve the legacy calls.
Unregister-Mock Get-VstsPipelineFeature
Unregister-Mock Get-InstalledMajorRelease
Unregister-Mock Get-MajorVersionOnAzurePackage

Register-Mock Get-VstsPipelineFeature { $true } -- `
    -FeatureName "ShowWarningOnOlderAzureModules"

Register-Mock Get-VstsPipelineFeature { $false } -- `
    -FeatureName "EnableAzureModuleVersionCheckRequestTimeout"

Register-Mock Get-InstalledMajorRelease { "12.1.0" }
Register-Mock Get-MajorVersionOnAzurePackage {
    @{ tag_name = "v13.0.0" }
}

Initialize-ModuleVersionValidation `
    -moduleName "azure-powershell" `
    -targetAzurePs "" `
    -displayModuleName "Az" `
    -versionsToReduce 3

Assert-WasCalled Get-InstalledMajorRelease -ParametersEvaluator {
    $moduleName -eq "Az" -and $isWin -and !$localOnly
}

Assert-WasCalled Get-MajorVersionOnAzurePackage -ParametersEvaluator {
    $moduleName -eq "azure-powershell" -and
    $null -eq $requestTimeoutSeconds
}