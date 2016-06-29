[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$resultsLocation = Get-ResultsLocation "C:\asdf.testsettings"

Assert-AreEqual $null $resultsLocation
