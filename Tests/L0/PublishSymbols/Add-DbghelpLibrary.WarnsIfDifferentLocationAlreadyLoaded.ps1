[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\DbghelpFunctions.ps1
$env:AGENT_HOMEDIRECTORY = 'SomeDrive:\AgentHome'
Register-Mock Assert-VstsPath { "$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll" }
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
Assert-WasCalled Invoke-LoadLibrary -Times 0
Assert-WasCalled Write-Warning -Times 2
Assert-WasCalled Write-Warning -- "UnexpectedDbghelpdllExpected0Actual1 $([System.Management.Automation.WildcardPattern]::Escape("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll")) $([System.Management.Automation.WildcardPattern]::Escape("SomeDrive:\SomeDir2\dbghelp.dll"))"
Assert-WasCalled Write-Warning -- "UnexpectedDbghelpdllExpected0Actual1 $([System.Management.Automation.WildcardPattern]::Escape("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll")) $([System.Management.Automation.WildcardPattern]::Escape("SomeDrive:\SomeDir3\dbghelp.dll"))"
