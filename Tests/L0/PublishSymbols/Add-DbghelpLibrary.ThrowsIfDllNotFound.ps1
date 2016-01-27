[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\DbghelpFunctions.ps1
$env:AGENT_HOMEDIRECTORY = 'SomeDrive:\AgentHome'
Register-Mock Assert-VstsPath { throw "This error should be thrown." } -- -LiteralPath "$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll" -PathType Leaf -PassThru
Register-Mock Get-CurrentProcess
Register-Mock Invoke-LoadLibrary

# Act/Assert.
Assert-Throws { Add-DbghelpLibrary } -MessagePattern "This error should be thrown."
