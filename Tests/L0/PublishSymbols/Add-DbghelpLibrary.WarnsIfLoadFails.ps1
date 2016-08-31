[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\DbghelpFunctions.ps1
Register-Mock Get-VstsTaskVariable { 'SomeDrive:\AgentHome' } -- -Name Agent.HomeDirectory -Require
Register-Mock Assert-VstsPath { "SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll" }
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
Register-Mock Invoke-LoadLibrary { [System.IntPtr]::Zero } # Zero indicates error.
Register-Mock Get-LastWin32Error { 123 }
Register-Mock Write-Warning

# Act.
Add-DbghelpLibrary

# Assert.
Assert-WasCalled Invoke-LoadLibrary -- -LiteralPath "SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll"
Assert-WasCalled Write-Warning -- "FailedToLoadDbghelpDllFrom0ErrorCode1 SomeDrive:\AgentHome\Externals\Symstore\dbghelp.dll 123"
