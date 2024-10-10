[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
Register-Mock Invoke-VstsTool {
        "["
        "  {"
        "    `"installationPath`": `"path1`""
        "  }"
        "]"
    } -- -FileName (Resolve-Path $PSScriptRoot\..\tools\vswhere.exe).Path -Arguments "-version [16.0,17.0) -latest -format json" -RequireExitCodeZero

# Act.
$null = Get-VisualStudio 16
$actual = Get-VisualStudio 16

# Assert.
Assert-AreEqual -Expected "path1" -Actual $actual.installationPath
Assert-WasCalled Invoke-VstsTool -Times 1