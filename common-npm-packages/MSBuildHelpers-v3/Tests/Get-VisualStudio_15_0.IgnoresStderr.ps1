[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
Register-Mock Invoke-VstsTool {
        Write-Error "Some simulated STDERR content" -ErrorAction Continue 2>&1
        "["
        "  {"
        "    `"installationPath`": `"some path`""
        "  }"
        "]"
    } -- -FileName (Resolve-Path $PSScriptRoot\..\tools\vswhere.exe).Path -Arguments "-version [15.0,16.0) -latest -format json" -RequireExitCodeZero

# Act.
$actual = Get-VisualStudio 15

# Assert.
Assert-AreEqual -Expected "some path" -Actual $actual.installationPath
