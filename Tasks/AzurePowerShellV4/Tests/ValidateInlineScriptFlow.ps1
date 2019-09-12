[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Get-VstsInput
$targetAzurePs = "4.1.0"
if([string]::IsNullOrEmpty($env:Agent_TempDirectory)) {
    $env:Agent_TempDirectory = $env:TEMP
}
Register-Mock Get-VstsInput { "InlineScript" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { ",@( 'item 1', 'item 2')" } -- -Name Inline
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Initialize-AzModule
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Get-VstsEndpoint
Register-Mock Assert-VstsPath
Register-Mock Invoke-VstsTool { }

# Act.
$actual = @( & $PSScriptRoot\..\AzurePowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.