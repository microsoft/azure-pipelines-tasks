[CmdletBinding()]
param()

# Setup
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# Stub out module not under test, but required to import SymbolsCommon.psm1
$emptyModule = New-Module -Name VstsTaskSdk -ScriptBlock { $null }
Unregister-Mock Import-Module # Undo mock created by Tests\lib\Initialize-Test.ps1 preventing emptyModule stub

try
{
    Import-Module $emptyModule

    # Import code under test
    Import-Module $PSScriptRoot\..\SymbolsCommon.psm1

    # Stub out file access under test
    $null = [System.IO.Directory]::CreateDirectory("$($env:TEMP)\V1Agent\Agent\Worker\Tools\Pdbstr")
                    [System.IO.File]::WriteAllText("$($env:TEMP)\V1Agent\Agent\Worker\Tools\Pdbstr\pdbstr.exe", "")
    $null = [System.IO.Directory]::CreateDirectory("$($env:TEMP)\V1Agent\Agent\Worker\Tools\Symstore")
                    [System.IO.File]::WriteAllText("$($env:TEMP)\V1Agent\Agent\Worker\Tools\Symstore\dbghelp.dll", "")
                    [System.IO.File]::WriteAllText("$($env:TEMP)\V1Agent\Agent\Worker\Tools\Symstore\Symstore.exe", "")
    $null = [System.IO.Directory]::CreateDirectory("$($env:TEMP)\V2Agent\externals\pdbstr")
                    [System.IO.File]::WriteAllText("$($env:TEMP)\V2Agent\externals\pdbstr\pdbstr.exe", "")
    $null = [System.IO.Directory]::CreateDirectory("$($env:TEMP)\V2Agent\externals\symstore")
                    [System.IO.File]::WriteAllText("$($env:TEMP)\V2Agent\externals\symstore\dbghelp.dll", "")
                    [System.IO.File]::WriteAllText("$($env:TEMP)\V2Agent\externals\symstore\Symstore.exe", "")
    $taskRoot = [System.IO.Path]::GetDirectoryName("$PSScriptRoot") # Parent of Tests dir

    # Mock file access not under test
    Register-Mock Assert-VstsPath

    # V2 agent, UseDbgLkg default to true
    Register-Mock Get-VstsTaskVariable { "$($env:TEMP)\V2Agent" } -- -Name Agent.HomeDirectory -Require
    $env:PublishSymbols_Debug = "true"
    $env:PublishSymbols_UseDbgLkg = $null
    Assert-AreEqual -Expected "$taskRoot\dbghelp.dll" -Actual (Get-DbghelpPath)
    Assert-AreEqual -Expected "$taskRoot\pdbstr.exe" -Actual (Get-PdbstrPath)
    Assert-AreEqual -Expected "$taskRoot\symstore.exe" -Actual (Get-SymStorePath)
    Unregister-Mock Get-VstsTaskVariable

    # V2 agent, UseDbgLkg explicitly true
    Register-Mock Get-VstsTaskVariable { "$($env:TEMP)\V2Agent" } -- -Name Agent.HomeDirectory -Require
    $env:PublishSymbols_Debug = "true"
    $env:PublishSymbols_UseDbgLkg = "true"
    Assert-AreEqual -Expected "$taskRoot\dbghelp.dll" -Actual (Get-DbghelpPath)
    Assert-AreEqual -Expected "$taskRoot\pdbstr.exe" -Actual (Get-PdbstrPath)
    Assert-AreEqual -Expected "$taskRoot\symstore.exe" -Actual (Get-SymStorePath)
    Unregister-Mock Get-VstsTaskVariable

    # V2 agent, UseDbgLkg explicitly false (opt-out)
    Register-Mock Get-VstsTaskVariable { "$($env:TEMP)\V2Agent" } -- -Name Agent.HomeDirectory -Require
    $env:PublishSymbols_Debug = "true"
    $env:PublishSymbols_UseDbgLkg = "false"
    Assert-AreEqual -Expected "$($env:TEMP)\V2Agent\externals\symstore\dbghelp.dll" -Actual (Get-DbghelpPath)
    Assert-AreEqual -Expected "$($env:TEMP)\V2Agent\externals\pdbstr\pdbstr.exe" -Actual (Get-PdbstrPath)
    Assert-AreEqual -Expected "$($env:TEMP)\V2Agent\externals\symstore\symstore.exe" -Actual (Get-SymStorePath)
    Unregister-Mock Get-VstsTaskVariable
    
    # V1 agent, UseDbgLkg true
    Register-Mock Get-VstsTaskVariable { "$($env:TEMP)\V1Agent" } -- -Name Agent.HomeDirectory -Require
    $env:PublishSymbols_Debug = "true"
    $env:PublishSymbols_UseDbgLkg = "true"
    Assert-AreEqual -Expected "$taskRoot\dbghelp.dll" -Actual (Get-DbghelpPath)
    Assert-AreEqual -Expected "$taskRoot\pdbstr.exe" -Actual (Get-PdbstrPath)
    Assert-AreEqual -Expected "$taskRoot\symstore.exe" -Actual (Get-SymStorePath)
    Unregister-Mock Get-VstsTaskVariable
    
    # V1 agent, UseDbgLkg explicitly false
    Register-Mock Get-VstsTaskVariable { "$($env:TEMP)\V1Agent" } -- -Name Agent.HomeDirectory -Require
    $env:PublishSymbols_Debug = "true"
    $env:PublishSymbols_UseDbgLkg = "false"
    Assert-AreEqual -Expected "$($env:TEMP)\V1Agent\Agent\Worker\Tools\Symstore\dbghelp.dll" -Actual (Get-DbghelpPath)
    Assert-AreEqual -Expected "$($env:TEMP)\V1Agent\Agent\Worker\Tools\Pdbstr\pdbstr.exe" -Actual (Get-PdbstrPath)
    Assert-AreEqual -Expected "$($env:TEMP)\V1Agent\Agent\Worker\Tools\Symstore\symstore.exe" -Actual (Get-SymStorePath)
    Unregister-Mock Get-VstsTaskVariable

    # Assert the build contains this dependency from the archivePackage
    Assert-WasCalled Assert-VstsPath
}
finally
{
    # Cleanup before running other tests
    Remove-Module VstsTaskSdk
    $env:PublishSymbols_Debug = $null
    $env:PublishSymbols_UseDbgLkg = $null
}
