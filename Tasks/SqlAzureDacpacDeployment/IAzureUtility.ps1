
# create firewall rule for ip address range on azure sql database server on classic azure
function Create-AzureSqlDatabaseServerFirewallRuleRDFE
{
    param([String] [Parameter(Mandatory = $true)] $startIp,
          [String] [Parameter(Mandatory = $true)] $endIp,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)
}

# return azure resourcegroup name for azure sql database server present in RM, if not present throws
function Get-AzureSqlDatabaseServerRGName
{
    param([String] [Parameter(Mandatory = $true)] $serverName)
}

# create firewall rule for ip address range on azure sql database server on RM azure
function Create-AzureSqlDatabaseServerFirewallRuleARM
{
    param([String] [Parameter(Mandatory = $true)] $startIp,
          [String] [Parameter(Mandatory = $true)] $endIp,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)
}

# deletes firewall rule on azure sql database server on classic azure
function Delete-AzureSqlDatabaseServerFirewallRuleRDFE
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)
}

# deletes firewall rule on azure sql database server on RM azure
function Delete-AzureSqlDatabaseServerFirewallRuleARM
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)
}