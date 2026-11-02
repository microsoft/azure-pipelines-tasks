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
Register-Mock Invoke-LoadLibrary
Register-Mock Write-Warning

# Act.
Add-DbghelpLibrary 

# Assert.
Assert-WasCalled Invoke-LoadLibrary -Times 1 -- -LiteralPath "SomeDrive:\AgentHome\...\dbghelp.dll"
Assert-WasCalled Write-Warning -Times 0
$method = [IndexHelpers.Dbghelp.NativeMethods].GetMethod('SymInitialize')
$attribute = $method.GetCustomAttributes([System.Runtime.InteropServices.DllImportAttribute], $false)[0]
Assert-AreEqual "SomeDrive:\AgentHome\...\dbghelp.dll" $attribute.Value
