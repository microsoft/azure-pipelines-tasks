[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1


#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"

Register-Mock Add-AzureSqlDatabaseServerFirewallRule { 
    throw "IPAddress mentioned is not a valid IPv4 address." 
} -ParametersEvaluator { $startIPAddress -eq $outOfRangeIPAddress }

Register-Mock Add-AzureSqlDatabaseServerFirewallRule {
    throw "Sql Database Server: '$invalidAzureSqlServerName' not found."
} -ParametersEvaluator { $serverName -eq $invalidAzureSqlServerName }

Assert-Throws {
    Create-AzureSqlDatabaseServerFirewallRule -startIp $outOfRangeIPAddress -endIP $endIP -serverName $azureSqlServerName -endpoint $certEndpoint
} -MessagePattern "IPAddress mentioned is not a valid IPv4 address."

Assert-Throws {
    Create-AzureSqlDatabaseServerFirewallRule -startIp $startIP -endIP $endIP -serverName $invalidAzureSqlServerName -endpoint $certEndpoint
} -MessagePattern "Sql Database Server: '$invalidAzureSqlServerName' not found."

Register-Mock Add-AzureSqlDatabaseServerFirewallRule { 
    $azureSqlDatabaseServerFirewallRule = @{ };
    $azureSqlDatabaseServerFirewallRule.RuleName = "RuleName";
    $azureSqlDatabaseServerFirewallRule.IsConfigured = $true;
    return $azureSqlDatabaseServerFirewallRule;
}  -ParametersEvaluator { $endpoint.Auth.Scheme -eq  $certAuth.Scheme }

$azureSqlDatabaseServerFirewallRule = Create-AzureSqlDatabaseServerFirewallRule -startIp $startIP -endIP $endIP -serverName $azureSqlServerName -endpoint $certEndpoint

Assert-IsNotNullOrEmpty $azureSqlDatabaseServerFirewallRule "Firewall Rule - certificate end point cannot be null"
Assert-IsNotNullOrEmpty $azureSqlDatabaseServerFirewallRule.RuleName "Firewall Rule - certificate end point 'Rule Name' cannot be null"
Assert-AreEqual $true $azureSqlDatabaseServerFirewallRule.IsConfigured
