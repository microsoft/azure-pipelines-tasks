[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..

Register-Mock Get-VstsTaskVariable { 'TFS_Build' } -- -Name AZURE_HTTP_USER_AGENT

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments'

# Assert.
Assert-AreEqual "Some arguments /p:_MSDeployUserAgent=`"TFS_Build`"" $actual
