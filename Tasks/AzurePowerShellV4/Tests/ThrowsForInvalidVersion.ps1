[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "foobar.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { "OtherVersion" } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "x.y.z" } -- -Name CustomTargetAzurePs
Register-Mock Get-VstsTaskVariable { $env:PSModulePath } -- -Name 'AZ_PS_MODULE_PATH' -Require

# Act/Assert.
Assert-Throws {
    & $PSScriptRoot\..\AzurePowerShell.ps1
} -MessagePattern "InvalidAzurePsVersion*x.y.z"

# Clean Up
Unregister-Mock Get-VstsTaskVariable
