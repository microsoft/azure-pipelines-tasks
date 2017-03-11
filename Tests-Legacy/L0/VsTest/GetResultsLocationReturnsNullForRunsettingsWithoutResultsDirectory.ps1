[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$temprunsettingsfile = [io.path]::ChangeExtension([io.path]::GetTempFileName(),"runsettings")
$runsettings = @('<RunSettings><RunConfiguration>
</RunConfiguration></RunSettings>
')
Set-Content -Value $runsettings -Path $temprunsettingsfile

$resultsLocation = Get-ResultsLocation $temprunsettingsfile

Assert-AreEqual $null $resultsLocation 


if(Test-Path $temprunsettingsfile){
	Remove-Item $temprunsettingsfile
}