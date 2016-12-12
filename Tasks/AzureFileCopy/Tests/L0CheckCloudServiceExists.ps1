[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry { }
$invalidCloudServiceName = "invalidCloudServiceName"

# Test 1 "It should throw if cloudservice does not exist and connection type is cert"
Assert-Throws {
    Check-AzureCloudServiceExists -cloudServiceName $invalidCloudServiceName -connectionType 'Certificate'
} -MessagePattern "AFC_ResourceGroupNotFoundForSelectedConnection *"

# Test 2 "Should not throw If cloud service exists"
$rgWithClassicVMs = "taskplatformtesttwovm"
Check-AzureCloudServiceExists -cloudServiceName $rgWithClassicVMs -connectionType 'Certificate'

# Test 3 "Should not throw if cloud service exists and connection type is not cert"
Check-AzureCloudServiceExists -cloudServiceName $invalidCloudServiceName -connectionType 'UserNamePassword'
