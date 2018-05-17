[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "foobar.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { "OtherVersion" } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "x.y.z" } -- -Name CustomTargetAzurePs

# Act/Assert.
Assert-Throws {
    & $PSScriptRoot\..\AzurePowerShell.ps1
} -MessagePattern "InvalidAzurePsVersion*x.y.z"
