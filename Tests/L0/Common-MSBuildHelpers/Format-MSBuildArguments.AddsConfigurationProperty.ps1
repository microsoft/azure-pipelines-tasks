[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -Configuration 'Some configuration'

# Assert.
Assert-AreEqual "Some arguments /p:configuration=`"Some configuration`"" $actual
