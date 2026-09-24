[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\DbghelpFunctions.ps1
Register-Mock Get-DbghelpPath { "SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll" }
Register-Mock Initialize-DbghelpNativeMethods
Register-Mock Get-CurrentProcess {
    New-Object psobject -Property @{
            Id = $PID
            Modules = @(
                New-Object psobject -Property @{
                    ModuleName = 'SomeModule2.dll'
                    FileName = 'SomeDrive:\SomeDir\SomeModule2.dll'
                }
                New-Object psobject -Property @{
                    ModuleName = 'dbghelp.dll'
                    FileName = "SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll"
                }
            )
        }
}
Register-Mock Invoke-LoadLibrary

# Act.
Add-DbghelpLibrary 

# Assert.
Assert-WasCalled Initialize-DbghelpNativeMethods -- -DbghelpPath "SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll"
Assert-WasCalled Invoke-LoadLibrary -Times 0