[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\DbghelpFunctions.ps1
Register-Mock Get-DbghelpPath { "SomeDrive:\AgentHome\...\dbghelp.dll" }
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
Register-Mock Invoke-LoadLibrary
Register-Mock Write-Warning

# Act.
Add-DbghelpLibrary

# Assert.
Assert-WasCalled Invoke-LoadLibrary -- -LiteralPath "SomeDrive:\AgentHome\...\dbghelp.dll"
Assert-WasCalled Write-Warning -Times 0
