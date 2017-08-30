[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$json = (( Get-Content "$PSScriptRoot\..\..\..\..\Tasks\DeployVisualStudioTestAgent\make.json") -Join " ") | ConvertFrom-Json
$testExecutionUrl = $json.externals.files.url

$isSameVersion = Get-Content "$PSScriptRoot\..\..\..\..\Tasks\DeployVisualStudioTestAgent\CreateOfflineTestAgent.ps1" | Select-String $testExecutionUrl -quiet
Assert-AreEqual -Expected 1 -Actual $isSameVersion.Count -Message "$testExecutionUrl is not found in CreateOfflineTestAgent.ps1"