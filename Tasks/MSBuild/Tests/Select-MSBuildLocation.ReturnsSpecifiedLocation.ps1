[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-MSBuildLocation.ps1

# Act.
$actual = Select-MSBuildLocation -Method 'Location' -Location 'Some location' -Version 'Some version' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some location' $actual
