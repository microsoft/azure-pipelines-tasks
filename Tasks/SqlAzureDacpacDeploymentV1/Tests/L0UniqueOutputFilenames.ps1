# Tests verifying that Extract-Dacpac and Export-Bacpac generate unique output file paths
# to prevent collisions when multiple steps target the same database name.
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY = "C:\DefaultWorkingDirectory"

Register-Mock Get-VstsPipelineFeature { return $false }
. $PSScriptRoot\..\SqlAzureActions.ps1

$guidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# Test 1 - Extract-Dacpac generates unique GUID-based filenames on consecutive calls
$script:lastCapturedTargetFile = $null
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" } -ParametersEvaluator {
    if (-not $isOutputSecure) { $script:lastCapturedTargetFile = $targetFile }
    $true
}
Register-Mock Execute-SqlPackage { }

Extract-Dacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
$firstDacpacPath = $script:lastCapturedTargetFile

Extract-Dacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
$secondDacpacPath = $script:lastCapturedTargetFile

Assert-IsNotNullOrEmpty $firstDacpacPath "Extract-Dacpac: target file path should not be empty"
Assert-IsNotNullOrEmpty $secondDacpacPath "Extract-Dacpac: target file path should not be empty"
Assert-AreEqual $true ($firstDacpacPath -like "*$databaseName*") "Extract-Dacpac: target file should contain database name"
Assert-AreEqual $true ($secondDacpacPath -like "*$databaseName*") "Extract-Dacpac: target file should contain database name"
Assert-AreEqual $true ($firstDacpacPath -match $guidPattern) "Extract-Dacpac: target file should contain a GUID"
Assert-AreEqual $true ($secondDacpacPath -match $guidPattern) "Extract-Dacpac: target file should contain a GUID"
Assert-AreEqual $true ($firstDacpacPath -like "*.dacpac") "Extract-Dacpac: target file should have .dacpac extension"
Assert-AreEqual $true ($secondDacpacPath -like "*.dacpac") "Extract-Dacpac: target file should have .dacpac extension"
Assert-AreNotEqual $firstDacpacPath $secondDacpacPath "Extract-Dacpac: consecutive calls should produce unique file paths"

# Test 2 - Export-Bacpac generates unique GUID-based filenames on consecutive calls
Unregister-Mock Get-SqlPackageCommandArguments
Unregister-Mock Execute-SqlPackage

$script:lastCapturedTargetFile = $null
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" } -ParametersEvaluator {
    if (-not $isOutputSecure) { $script:lastCapturedTargetFile = $targetFile }
    $true
}
Register-Mock Execute-SqlPackage { }

Export-Bacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
$firstBacpacPath = $script:lastCapturedTargetFile

Export-Bacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
$secondBacpacPath = $script:lastCapturedTargetFile

Assert-IsNotNullOrEmpty $firstBacpacPath "Export-Bacpac: target file path should not be empty"
Assert-IsNotNullOrEmpty $secondBacpacPath "Export-Bacpac: target file path should not be empty"
Assert-AreEqual $true ($firstBacpacPath -like "*$databaseName*") "Export-Bacpac: target file should contain database name"
Assert-AreEqual $true ($secondBacpacPath -like "*$databaseName*") "Export-Bacpac: target file should contain database name"
Assert-AreEqual $true ($firstBacpacPath -match $guidPattern) "Export-Bacpac: target file should contain a GUID"
Assert-AreEqual $true ($secondBacpacPath -match $guidPattern) "Export-Bacpac: target file should contain a GUID"
Assert-AreEqual $true ($firstBacpacPath -like "*.bacpac") "Export-Bacpac: target file should have .bacpac extension"
Assert-AreEqual $true ($secondBacpacPath -like "*.bacpac") "Export-Bacpac: target file should have .bacpac extension"
Assert-AreNotEqual $firstBacpacPath $secondBacpacPath "Export-Bacpac: consecutive calls should produce unique file paths"
