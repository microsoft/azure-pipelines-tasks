[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
Register-Mock Invoke-VstsTool {
        "["
        "  {"
        "    `"installationPath`": `"path1`""
        "  }"
        "]"
    } -- -FileName (Resolve-Path $PSScriptRoot\..\vswhere.exe).Path -Arguments "-version [15.0,16.0) -latest -format json" -RequireExitCodeZero

# Act.
$null = Get-VisualStudio_15_0
$actual = Get-VisualStudio_15_0

# Assert.
Assert-AreEqual -Expected "path1" -Actual $actual.installationPath
Assert-WasCalled Invoke-VstsTool -Times 1