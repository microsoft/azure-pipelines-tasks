[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTestV1\Helpers.ps1

$resultsLocation = Get-ResultsLocation "C:\asdf.testsettings"

Assert-AreEqual $null $resultsLocation
