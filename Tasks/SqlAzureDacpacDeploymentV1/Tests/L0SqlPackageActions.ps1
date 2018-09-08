# Tests for helper methods in SqlAzureActions.ps1
[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY = "C:\DefaultWorkingDirectory"

# Test 1 - Assert publish action 
Register-Mock Find-SqlFiles { return "C:\Test\TestFile.dacpac" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\TestFile.dacpac" }
Register-Mock Find-SqlFiles { return "C:\Test\publish.xml" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\publish.xml" }
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Publish-Dacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -dacpacFile $dacpacFile -publishProfile $publishProfile -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments

Assert-WasCalled Find-SqlFiles -Times 2
Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1

# Test 2 - Assert Extract action
Unregister-Mock Get-SqlPackageCommandArguments 
Unregister-Mock Execute-SqlPackage
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Extract-Dacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments    

Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1

# Test 3 - Assert Export action
Unregister-Mock Get-SqlPackageCommandArguments 
Unregister-Mock Execute-SqlPackage
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Export-Bacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments

Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1

# Test 4 - Assert Import action
Unregister-Mock Get-SqlPackageCommandArguments 
Unregister-Mock Execute-SqlPackage
Unregister-Mock Find-SqlFiles

Register-Mock Find-SqlFiles { return "C:\Test\TestFile.bacpac" }
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Import-Bacpac -bacpacFile $bacpacFile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments

Assert-WasCalled Find-SqlFiles -Times 1
Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1

# Test 5 - Assert Drift Report action
Unregister-Mock Get-SqlPackageCommandArguments 
Unregister-Mock Execute-SqlPackage

Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Drift-Report -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments

Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1

# Test 6 - Assert Deploy Report action
Unregister-Mock Get-SqlPackageCommandArguments 
Unregister-Mock Execute-SqlPackage
Unregister-Mock Find-SqlFiles

Register-Mock Find-SqlFiles { return "C:\Test\TestFile.dacpac" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\TestFile.dacpac" }
Register-Mock Find-SqlFiles { return "C:\Test\publish.xml" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\publish.xml" }
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Deploy-Report -dacpacFile $dacpacFile -publishProfile $publishProfile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments

Assert-WasCalled Find-SqlFiles -Times 2
Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1

# Test 7 - Assert Script action
Unregister-Mock Get-SqlPackageCommandArguments 
Unregister-Mock Execute-SqlPackage
Unregister-Mock Find-SqlFiles

Register-Mock Find-SqlFiles { return "C:\Test\TestFile.dacpac" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\TestFile.dacpac" }
Register-Mock Find-SqlFiles { return "C:\Test\publish.xml" } -ParametersEvaluator { $filePathPattern -eq "C:\Test\publish.xml" }
Register-Mock Get-SqlPackageCommandArguments { return "SqlPackage.exe command" }
Register-Mock Execute-SqlPackage { }

Script-Action -dacpacFile $dacpacFile -publishProfile $publishProfile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments

Assert-WasCalled Get-SqlPackageCommandArguments -Times 2
Assert-WasCalled Execute-SqlPackage -Times 1


