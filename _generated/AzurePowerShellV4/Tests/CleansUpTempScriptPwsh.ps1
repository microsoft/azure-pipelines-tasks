[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Get-VstsInput { $true } -- -Name pwsh -AsBool
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Initialize-AzModule
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} }
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Assert-VstsPath
Register-Mock Invoke-VstsTool { }
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module
Register-Mock ConvertTo-SecureString

# Set Agent_TempDirectory so the script writes to a known location.
$testTempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testTempDir -Force | Out-Null
$env:Agent_TempDirectory = $testTempDir

# Act.
$actual = & $PSScriptRoot\..\AzurePowerShell.ps1

# Assert: the generated temp script (pwsh path) was cleaned up by the finally block.
$leftoverScripts = Get-ChildItem $testTempDir -Filter "*.ps1" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.ps1$' }
Assert-AreEqual 0 @($leftoverScripts).Count "Temp script should be deleted after execution (pwsh mode)"

# Cleanup.
$env:Agent_TempDirectory = $null
if (Test-Path $testTempDir) { Remove-Item $testTempDir -Recurse -Force -ErrorAction SilentlyContinue }
