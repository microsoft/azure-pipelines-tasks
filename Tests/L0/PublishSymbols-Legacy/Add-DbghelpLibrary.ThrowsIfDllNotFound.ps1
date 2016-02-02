[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$env:AGENT_HOMEDIRECTORY = 'SomeDrive:\AgentHome'
Register-Mock Test-Path { $false }
Register-Mock Get-CurrentProcess
Register-Mock Add-DbghelpLibraryCore

# Assert.
Assert-Throws {
        # Act.
        Add-DbghelpLibrary 
    } -MessagePattern "Could not find dbghelp.dll at: $([System.Management.Automation.WildcardPattern]::Escape("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll"))"
Assert-WasCalled Test-Path -- -LiteralPath "$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll" -PathType Leaf
