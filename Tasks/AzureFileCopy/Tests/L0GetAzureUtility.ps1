[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$requireSwitchAzureModeVersion = New-Object -TypeName System.Version -ArgumentList "0.9.7"
$notRequireSwitchAzureModeVersion = New-Object -TypeName System.Version -ArgumentList "1.0.1"
$azureRMVersion104 = New-Object -TypeName System.Version -ArgumentList "1.0.4"
$azureRMVersion133 = New-Object -TypeName System.Version -ArgumentList "1.3.3"
$connectedServiceName = "DummyConnectedServiceName"

Register-Mock Get-TypeOfConnection { return "ServicePrincipal"}

. $PSScriptRoot\..\Utility.ps1

#Test 1 "Should return AzureUtilityLTE9.8.ps1 if version is less than equal to 0.9.8"
Register-Mock Get-AzureCmdletsVersion { return $requireSwitchAzureModeVersion }
$azureUtilityFile = Get-AzureUtility -connectedServiceName $connectedServiceName
Assert-AreEqual $azureUtilityFile "AzureUtilityLTE9.8.ps1"

#Test 2 "Should return AzureUtilityGTE1.0.ps1 if version is greater than equal to 1.0.0"
Unregister-Mock Get-AzureCmdletsVersion
Register-Mock Get-AzureCmdletsVersion { return $notRequireSwitchAzureModeVersion }
$azureUtilityFile = Get-AzureUtility -connectedServiceName $connectedServiceName
Assert-AreEqual $azureUtilityFile "AzureUtilityGTE1.0.ps1"

#Test 3 "Should return AzureUtilityGTE1.1.0.ps1 if version is greater than equal to 1.0.3"
Unregister-Mock Get-AzureCmdletsVersion
Register-Mock Get-AzureCmdletsVersion { return $azureRMVersion104 }
$azureUtilityFile = Get-AzureUtility -connectedServiceName $connectedServiceName
Assert-AreEqual $azureUtilityFile "AzureUtilityGTE1.1.0.ps1"

#Test 4 "Should return AzureUtilityRest.ps1 if version is greater than equal to 1.3.2"
Unregister-Mock Get-AzureCmdletsVersion
Register-Mock Get-AzureCmdletsVersion { return $azureRMVersion133 }
$azureUtilityFile = Get-AzureUtility -connectedServiceName $connectedServiceName
Assert-AreEqual $azureUtilityFile "AzureUtilityRest.ps1"