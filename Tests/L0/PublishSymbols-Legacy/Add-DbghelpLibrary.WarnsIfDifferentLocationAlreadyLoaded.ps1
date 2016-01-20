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
                    ModuleName = 'dbghelp.dll'
                    FileName = 'SomeDrive:\SomeDir2\dbghelp.dll'
                }
                New-Object psobject -Property @{
                    ModuleName = 'dbghelp.dll'
                    FileName = 'SomeDrive:\SomeDir3\dbghelp.dll'
                }
            )
        }
}
Register-Mock Add-DbghelpLibraryCore
Register-Mock Write-Warning

# Act.
Add-DbghelpLibrary 

# Assert.
Assert-WasCalled Add-DbghelpLibraryCore -Times 0
Assert-WasCalled Write-Warning -Times 2
Assert-WasCalled Write-Warning -- "Library dbghelp.dll is already loaded from an unexpected file path: $([System.Management.Automation.WildcardPattern]::Escape("SomeDrive:\SomeDir2\dbghelp.dll")) ; Expected path: $([System.Management.Automation.WildcardPattern]::Escape("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll")) ; An incorrect version of the library may result in malformed source file paths to be extracted from the PDB files. If this condition occurs, it will be indicated in the logs below."
Assert-WasCalled Write-Warning -- "Library dbghelp.dll is already loaded from an unexpected file path: $([System.Management.Automation.WildcardPattern]::Escape("SomeDrive:\SomeDir3\dbghelp.dll")) ; Expected path: $([System.Management.Automation.WildcardPattern]::Escape("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll")) ; An incorrect version of the library may result in malformed source file paths to be extracted from the PDB files. If this condition occurs, it will be indicated in the logs below."
