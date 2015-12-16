[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1

# Act.
$actual = Select-MSBuildLocation -Method 'Location' -Location 'Some location' -Version 'Some version' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some location' $actual
