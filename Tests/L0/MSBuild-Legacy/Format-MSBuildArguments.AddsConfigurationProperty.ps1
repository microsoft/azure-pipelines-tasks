[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\LegacyHelpers.ps1

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -Configuration 'Some configuration'

# Assert.
Assert-AreEqual "Some arguments /p:configuration=`"Some configuration`"" $actual
