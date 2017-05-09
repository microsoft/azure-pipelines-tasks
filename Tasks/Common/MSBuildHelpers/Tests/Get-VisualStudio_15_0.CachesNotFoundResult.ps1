[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
$script:count = 0
Register-Mock Invoke-VstsTool {
        $script:count++
        "["
        "]"
    } -- -FileName (Resolve-Path $PSScriptRoot\..\vswhere.exe).Path -Arguments "-version [15.0,15.1) -latest -format json" -RequireExitCodeZero

# Act.
$null = Get-VisualStudio_15_0
$actual = Get-VisualStudio_15_0

# Assert.
Assert-AreEqual -Expected $null -Actual $actual
Assert-AreEqual -Expected 1 -Actual $script:count
