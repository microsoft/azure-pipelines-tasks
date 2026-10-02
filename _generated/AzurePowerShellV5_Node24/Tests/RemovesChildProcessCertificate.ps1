[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "myArmConnection" } -- -Name ConnectedServiceNameARM -Require
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/CrossProcessCertificateCleanup_Throws.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $false } -- -Name FailOnStandardError
Register-Mock Get-VstsInput { $true } -- -Name pwsh -AsBool -Default $false
Register-Mock Get-VstsInput { $env:Agent_TempDirectory } -- -Name workingDirectory -Require
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Get-VstsEndpoint { @{ auth = @{ scheme = "ServicePrincipal" } } } -- -Name myArmConnection -Require
Register-Mock Get-VstsEndpoint { @{ auth = @{ parameters = @{ AccessToken = "test-token" } } } } -- -Name SystemVssConnection -Require
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Assert-VstsPath
Register-Mock Get-VstsLocString { "PowerShell exited with code $LASTEXITCODE" }
Register-Mock Write-VstsTaskError
Register-Mock Write-VstsSetResult
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module

$testTempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString("N"))
$thumbprintFile = Join-Path $testTempDirectory "thumbprint.txt"
$customerScriptMarker = Join-Path $testTempDirectory "customer-script-executed.txt"
$env:Agent_TempDirectory = $testTempDirectory
$env:CROSS_PROCESS_THUMBPRINT_FILE = $thumbprintFile
$env:CROSS_PROCESS_HELPER_UTILITY = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\..\Common\VstsAzureHelpers_\Utility.ps1")
$env:CROSS_PROCESS_CUSTOMER_SCRIPT_MARKER = $customerScriptMarker
New-Item -ItemType Directory -Path $testTempDirectory -Force | Out-Null

Register-Mock Invoke-VstsTool {
    $generatedScript = Get-ChildItem $env:Agent_TempDirectory -Filter "*.ps1" | Select-Object -First 1
    $taskCoreAz = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\CoreAz.ps1")
    $fixtureCoreAz = [System.IO.Path]::GetFullPath("$PSScriptRoot\CrossProcessCertificateCleanup_CoreAz.ps1")
    $content = [System.IO.File]::ReadAllText($generatedScript.FullName).Replace($taskCoreAz, $fixtureCoreAz)
    [System.IO.File]::WriteAllText($generatedScript.FullName, $content)
    $null = & (Get-Command pwsh.exe).Path -NoLogo -NoProfile -NonInteractive -File $generatedScript.FullName 2>&1
}

try {
    & $PSScriptRoot\..\AzurePowerShell.ps1

    Assert-AreEqual $true (Test-Path $customerScriptMarker) "Customer script should execute before cleanup"
    Assert-AreEqual $true (Test-Path $thumbprintFile) "Child process should record the imported certificate thumbprint"
    $thumbprint = [System.IO.File]::ReadAllText($thumbprintFile)
    $certificate = Get-Item "Cert:\CurrentUser\My\$thumbprint" -ErrorAction SilentlyContinue
    Assert-AreEqual $null $certificate "Child-process finalizer should remove the imported certificate"
}
finally {
    if ($thumbprint -and (Test-Path "Cert:\CurrentUser\My\$thumbprint")) {
        Remove-Item "Cert:\CurrentUser\My\$thumbprint" -Force
    }
    Remove-Item $testTempDirectory -Recurse -Force -ErrorAction SilentlyContinue
    $env:Agent_TempDirectory = $null
    $env:CROSS_PROCESS_THUMBPRINT_FILE = $null
    $env:CROSS_PROCESS_HELPER_UTILITY = $null
    $env:CROSS_PROCESS_CUSTOMER_SCRIPT_MARKER = $null
}