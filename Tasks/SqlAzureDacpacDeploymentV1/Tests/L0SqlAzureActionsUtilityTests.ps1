[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\SqlAzureActions.ps1

# Test 1 - ipDetectionMethod = IPAddressRange
Register-Mock Get-AgentIPRange { }
Register-Mock Create-AzureSqlDatabaseServerFirewallRule { return @{
    RuleName = "TestRule";
    IsConfigured = $true;
}}

$firewallRuleName, $isFirewallConfigured = Add-FirewallRule -endpoint $spnEndpoint -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -ipDetectionMethod $ipDetectionMethod -startIPAddress $startIp -endIPAddress $endIp

Assert-WasCalled Get-AgentIPRange -Times 0
Assert-AreEqual "TestRule" $firewallRuleName
Assert-AreEqual $true $isFirewallConfigured

# Test 2 ipDetectionMethod = AutoDetect
Unregister-Mock Get-AgentIPRange
Unregister-Mock Create-AzureSqlDatabaseServerFirewallRule

Register-Mock Create-AzureSqlDatabaseServerFirewallRule { return @{
    RuleName = "TestRule";
    IsConfigured = $true;
}}

Register-Mock Get-AgentIPRange { return @{
    StartIpAddess = "0.0.0.0.";
    EndIpAddress = "255.255.255.255"
} }

$ipDetectionMethod = "AutoDetect"
$firewallRuleName, $isFirewallConfigured = Add-FirewallRule -endpoint $spnEndpoint -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -ipDetectionMethod $ipDetectionMethod -startIPAddress $startIp -endIPAddress $endIp

Assert-WasCalled Get-AgentIPRange -Times 1
Assert-AreEqual "TestRule" $firewallRuleName
Assert-AreEqual $true $isFirewallConfigured

# Test 3 - Find-SqlFiles
$dacpacFilePattern = "C:\TestFile\**\*.dacpac"

Register-Mock Find-VstsFiles { return "C:\TestFile\TestFile.dacpac" }
Register-Mock ThrowIfMultipleFilesOrNoFilePresent { }

$file = Find-SqlFiles -filePathPattern $dacpacFilePattern -verboseMessage "Dacpac file:" -throwIfMultipleFilesOrNoFilePresent

Assert-WasCalled Find-VstsFiles -Times 1
Assert-WasCalled ThrowIfMultipleFilesOrNoFilePresent -Times 1
Assert-AreEqual "C:\TestFile\TestFile.dacpac" $file

# Test 4 - Find-SqlFiles throws if no files found

Unregister-Mock Find-SqlFiles
Unregister-Mock ThrowIfMultipleFilesOrNoFilePresent

Register-Mock ThrowIfMultipleFilesOrNoFilePresent { throw (Get-VstsLocString -Key "SAD_FoundMoreFiles" -ArgumentList $dacpacFilePattern) }

Assert-Throws {
    Find-SqlFiles -filePathPattern $dacpacFilePattern -verboseMessage "Dacpac file:" -throwIfMultipleFilesOrNoFilePresent
} -Message "SAD_FoundMoreFiles C:\TestFile\**\*.dacpac"
