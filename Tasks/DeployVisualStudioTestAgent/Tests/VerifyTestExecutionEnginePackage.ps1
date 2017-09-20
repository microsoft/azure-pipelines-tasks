[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$json = (( Get-Content "$PSScriptRoot\..\make.json") -Join " ") | ConvertFrom-Json
$testExecutionUrl = $json.externals.files.url

$isSameVersion = Get-Content "$PSScriptRoot\..\CreateOfflineTestAgent.ps1" | Select-String $testExecutionUrl -quiet
Assert-AreEqual -Expected 1 -Actual $isSameVersion.Count -Message "$testExecutionUrl is not found in CreateOfflineTestAgent.ps1"