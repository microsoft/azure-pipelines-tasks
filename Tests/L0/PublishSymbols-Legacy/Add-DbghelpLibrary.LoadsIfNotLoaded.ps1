[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$env:AGENT_HOMEDIRECTORY = 'SomeDrive:\AgentHome'
Register-Mock Test-Path { $true }
Register-Mock Get-CurrentProcess {
    New-Object psobject -Property @{
            Id = $PID
            Modules = @(
                New-Object psobject -Property @{
                    ModuleName = 'SomeModule.dll'
                    FileName = 'SomeDrive:\SomeDir\SomeModule.dll'
                }
            )
        }
}
Register-Mock Add-DbghelpLibraryCore
Register-Mock Write-Warning

# Act.
Add-DbghelpLibrary 

# Assert.
Assert-WasCalled Add-DbghelpLibraryCore -- -LiteralPath "$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll"
Assert-WasCalled Write-Warning -Times 0
