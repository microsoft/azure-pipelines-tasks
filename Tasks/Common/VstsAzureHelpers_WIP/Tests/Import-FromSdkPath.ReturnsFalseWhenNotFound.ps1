[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# Setup the Program Files environment variables.
$env:ProgramFiles = 'no such program files'
${env:ProgramFiles(x86)} = 'no such program files x86'

# Setup the mocks.
Register-Mock Test-Path { $false }
Unregister-Mock Import-Module
Register-Mock Import-Module

# Act.
$result = & $module Import-FromSdkPath

# Assert.
Assert-AreEqual $false $result
Assert-WasCalled Import-Module -Times 0
