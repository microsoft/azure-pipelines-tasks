[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$azModule100 = New-Object -TypeName System.Version -ArgumentList "1.0.0"
$connectedServiceName = "DummyConnectedServiceName"

Register-Mock Get-TypeOfConnection { return "ServicePrincipal"}

. $PSScriptRoot\..\Utility.ps1

#Test 1 "Should return AzureUtilityAz1.0.ps1 if Az module is installed"
Register-Mock Get-Module { return $azModule100 }
$azureUtilityFile = Get-AzureUtility
Assert-AreEqual $azureUtilityFile "AzureUtilityAz1.0.ps1"

#Test 2 "Should return AzureUtilityARM.ps1 Az module is not installed"
Unregister-Mock Get-Module
Register-Mock Get-Module { return }
$azureUtilityFile = Get-AzureUtility -connectedServiceName $connectedServiceName
Assert-AreEqual $azureUtilityFile "AzureUtilityARM.ps1"
