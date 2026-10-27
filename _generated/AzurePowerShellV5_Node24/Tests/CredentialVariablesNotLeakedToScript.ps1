[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "myArmConnection" } -- -Name ConnectedServiceNameARM -Require
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/CredentialVariablesNotLeakedToScript_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $false } -- -Name FailOnStandardError
Register-Mock Get-VstsInput { $true } -- -Name pwsh -AsBool -Default $false
Register-Mock Get-VstsInput { $env:Agent_TempDirectory } -- -Name workingDirectory -Require
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Get-VstsEndpoint {
    @{
        auth = @{
            scheme = "ServicePrincipal"
            parameters = @{
                serviceprincipalkey = "arm-secret"
            }
        }
    }
} -- -Name myArmConnection -Require
Register-Mock Get-VstsEndpoint {
    @{
        auth = @{
            parameters = @{
                AccessToken = "job-token"
            }
        }
    }
} -- -Name SystemVssConnection -Require
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Assert-VstsPath
Register-Mock Write-VstsTaskError
Register-Mock Write-VstsSetResult
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module

$testTempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString("N"))
$env:Agent_TempDirectory = $testTempDirectory
New-Item -ItemType Directory -Path $testTempDirectory -Force | Out-Null
$global:credentialVariablesChildOutput = @()

Register-Mock Invoke-VstsTool {
    $generatedScript = Get-ChildItem $env:Agent_TempDirectory -Filter "*.ps1" | Select-Object -First 1
    $taskCoreAz = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\CoreAz.ps1")
    $fixtureCoreAz = [System.IO.Path]::GetFullPath("$PSScriptRoot\CredentialVariablesNotLeakedToScript_CoreAz.ps1")
    $content = [System.IO.File]::ReadAllText($generatedScript.FullName).Replace($taskCoreAz, $fixtureCoreAz)
    [System.IO.File]::WriteAllText($generatedScript.FullName, $content)
    $global:credentialVariablesChildOutput = @(& (Get-Command pwsh.exe).Path -NoLogo -NoProfile -NonInteractive -File $generatedScript.FullName 2>&1)
}

try {
    & $PSScriptRoot\..\AzurePowerShell.ps1

    $childOutputDescription = $global:credentialVariablesChildOutput -join [System.Environment]::NewLine
    Assert-AreEqual $true ($global:credentialVariablesChildOutput -contains "CREDENTIAL_SCOPE_CLEAN") "Customer script should not see credential variables. Child output: $childOutputDescription"
    Assert-AreEqual $false ([bool]($global:credentialVariablesChildOutput | Where-Object { $_ -like "CREDENTIAL_SCOPE_LEAK:*" })) "Customer script reported leaked credential variables"
}
finally {
    Remove-Item $testTempDirectory -Recurse -Force -ErrorAction SilentlyContinue
    $env:Agent_TempDirectory = $null
    $global:credentialVariablesChildOutput = $null
}
