[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Get-VSPath.ps1

$instance = New-Object  Object
Add-Member -NotePropertyName installationPath -NotePropertyValue 'use_vswhere' -inputObject $instance

Register-Mock Get-VisualStudio { $instance } -- '17'
Register-Mock Get-VisualStudio { $instance } -- '16'
Register-Mock Get-VisualStudio { $instance } -- '15'

# Act.
$path_17 = Get-VSPath '17.0'
$path_16 = Get-VSPath '16.0'
$path_15 = Get-VSPath '15.0'

# Assert.
Assert-AreEqual 'use_vswhere' $path_17
Assert-AreEqual 'use_vswhere' $path_16
Assert-AreEqual 'use_vswhere' $path_15
