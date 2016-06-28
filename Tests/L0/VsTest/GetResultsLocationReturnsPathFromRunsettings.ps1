[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$temprunsettingsfile = [io.path]::ChangeExtension([io.path]::GetTempFileName(),"runsettings")
$runsettings = @('<RunSettings><RunConfiguration>
<ResultsDirectory>C:\myResultsFolder</ResultsDirectory> 
</RunConfiguration></RunSettings>
')
Set-Content -Value $runsettings -Path $temprunsettingsfile

$resultsLocation = Get-ResultsLocation $temprunsettingsfile

Assert-AreEqual 'C:\myResultsFolder' $resultsLocation 


if(Test-Path $temprunsettingsfile){
	Remove-Item $temprunsettingsfile
}