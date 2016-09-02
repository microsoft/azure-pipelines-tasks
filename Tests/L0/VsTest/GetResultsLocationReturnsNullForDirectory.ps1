[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$tempDirName = [System.Guid]::NewGuid().ToString() + '.runsettings'
$tempDir = New-Item -Type Directory -Name $tempDirName

$resultsLocation = Get-ResultsLocation $tempDirName

Assert-AreEqual $null $resultsLocation 
