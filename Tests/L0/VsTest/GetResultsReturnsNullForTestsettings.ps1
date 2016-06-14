[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$resultsLocation = GetResultsLocation "C:\asdf.testsettings"

Assert-AreEqual $null $resultsLocation
