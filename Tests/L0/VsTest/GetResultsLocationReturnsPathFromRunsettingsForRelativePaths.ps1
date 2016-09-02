[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$tempsettingsfile = [io.path]::ChangeExtension([io.path]::GetTempFileName(),"runsettings")
$runsettings = @('<RunSettings><RunConfiguration>
<ResultsDirectory>.\myResultsFolder</ResultsDirectory> 
</RunConfiguration></RunSettings>
')
Set-Content -Value $runsettings -Path $tempsettingsfile

$resultsLocation = Get-ResultsLocation $tempsettingsfile

$expectedLocation = [io.path]::Combine([io.path]::GetDirectoryName($tempsettingsfile), "myResultsFolder")
Assert-AreEqual $expectedLocation $resultsLocation 


if(Test-Path $tempsettingsfile){
	Remove-Item $tempsettingsfile
}