[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
# . $PSScriptRoot\..\Select-VSVersion.ps1
. $PSScriptRoot\..\Get-VSPath.ps1
$instance = New-Object  Object
Add-Member -NotePropertyName installationPath -NotePropertyValue blablabla -inputObject $instance

Register-Mock Get-VisualStudio { $instance } -- -Version '17.0'
Write-Verbose "-------------"
Write-Verbose $instance.installationPath
Write-Verbose "-------------"
# Act.

$pathddd = Get-VSPath -Version '17.0'

Write-Verbose '+++++++++++'
Write-Verbose $pathddd
Write-Verbose '+++++++++++'

# Assert.
Assert-AreEqual 'D:\agent\vsts-agent-mauta-1\_work\_tasks\VSBuild126_71a9a2d3-a98a-4caa-96ab-affca126ecda\1.192.1\ps_modules\MSBuildHelpers\vswhere.exe' $pathddd
