[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

Unregister-Mock Get-UserAgentString
Register-Mock Get-UserAgentString { 'TFS_Build' }

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments'

# Assert.
Assert-AreEqual "Some arguments /p:_MSDeployUserAgent=`"TFS_Build`"" $actual
