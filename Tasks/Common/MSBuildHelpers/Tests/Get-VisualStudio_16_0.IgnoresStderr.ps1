[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
Register-Mock Invoke-VstsTool {
        Write-Error "Some simulated STDERR content" -ErrorAction Continue 2>&1
        "["
        "  {"
        "    `"installationPath`": `"some path`""
        "  }"
        "]"
    } -- -FileName (Resolve-Path $PSScriptRoot\..\vswhere.exe).Path -Arguments "-version [16.0,17.0) -latest -format json" -RequireExitCodeZero

# Act.
$actual = Get-VisualStudio 16

# Assert.
Assert-AreEqual -Expected "some path" -Actual $actual.installationPath
