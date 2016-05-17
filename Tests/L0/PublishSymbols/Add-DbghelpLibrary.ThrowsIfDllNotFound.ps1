[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\DbghelpFunctions.ps1
Register-Mock Get-VstsTaskVariable { 'SomeDrive:\AgentHome' } -- -Name Agent.HomeDirectory -Require
Register-Mock Assert-VstsPath { throw "This error should be thrown." } -- -LiteralPath "SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll" -PathType Leaf -PassThru
Register-Mock Get-CurrentProcess
Register-Mock Invoke-LoadLibrary

# Act/Assert.
Assert-Throws { Add-DbghelpLibrary } -MessagePattern "This error should be thrown."
