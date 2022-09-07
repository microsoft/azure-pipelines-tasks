[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..

Register-Mock Get-VstsTaskVariable { '' } -- -Name AZURE_HTTP_USER_AGENT

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -VSVersion 'Some version'

# Assert.
Assert-AreEqual "Some arguments /p:VisualStudioVersion=`"Some version`"" $actual
