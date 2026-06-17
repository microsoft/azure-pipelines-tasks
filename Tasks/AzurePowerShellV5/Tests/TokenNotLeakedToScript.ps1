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
Register-Mock Get-VstsInput { $true } -- -Name pwsh -AsBool -Default $false
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Initialize-AzModule
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} }
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Assert-VstsPath
Register-Mock Invoke-VstsTool { }
Register-Mock Write-VstsTaskError
Register-Mock Write-VstsSetResult
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module

# Set Agent_TempDirectory so the script writes to a known location.
$testTempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testTempDir -Force | Out-Null
$env:Agent_TempDirectory = $testTempDir

# Mock Remove-Item to prevent the finally block from deleting the temp script.
Register-Mock Remove-Item { }

# Act.
$actual = & $PSScriptRoot\..\AzurePowerShell.ps1

# Assert: read the generated script that was preserved (Remove-Item was mocked).
$scriptFile = Get-ChildItem $testTempDir -Filter "*.ps1" -ErrorAction SilentlyContinue | Select-Object -First 1
Assert-AreNotEqual $null $scriptFile "Generated temp script should exist (Remove-Item was mocked)"
$scriptContent = [System.IO.File]::ReadAllText($scriptFile.FullName)
Assert-AreEqual $true ($scriptContent -like '*CoreAz.ps1*') "Script should reference CoreAz.ps1"
Assert-AreEqual $true ($scriptContent -like '*$env:__VSTS_ACCESS_TOKEN*') "Script should use env var for token"
Assert-AreEqual $false ($scriptContent -match 'vstsAccessToken\s+(eyJ|[A-Za-z0-9+/=]{20,})') "Script must not contain literal token value"

# Cleanup.
$env:Agent_TempDirectory = $null
if (Test-Path $testTempDir) { Remove-Item $testTempDir -Recurse -Force -ErrorAction SilentlyContinue }
