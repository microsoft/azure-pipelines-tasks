# This file implements IAzureUtility for Azure PowerShell version >= 1.0.0

function Create-AzureSqlDatabaseServerFirewallRuleRDFE
{
    param([String] [Parameter(Mandatory = $true)] $startIPAddress,
          [String] [Parameter(Mandatory = $true)] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Write-Verbose "[Azure Platform Call] Creating firewall rule $firewallRuleName"  -Verbose
    $azureSqlDatabaseServerFirewallRule = New-AzureSqlDatabaseServerFirewallRule -StartIPAddress $startIPAddress -EndIPAddress $endIPAddress -ServerName $serverName `
                                                                                 -RuleName $firewallRuleName -ErrorAction Stop
    Write-Verbose "[Azure Platform Call] Firewall rule $firewallRuleName created"  -Verbose

    return $azureSqlDatabaseServerFirewallRule
}

function Get-AzureSqlDatabaseServerRGName
{
    param([String] [Parameter(Mandatory = $true)] $serverName)

    $ARMSqlServerResourceType =  "Microsoft.Sql/servers"
    try
    {
        Write-Verbose "[Azure Call]Getting resource details for azure sql server resource: $serverName with resource type: $ARMSqlServerResourceType" -Verbose
        $azureSqlServerResourceDetails = (Get-AzureRMResource -ErrorAction Stop) | Where-Object { $_.ResourceName -eq $serverName -and $_.ResourceType -eq $ARMSqlServerResourceType }
        Write-Verbose "[Azure Call]Retrieved resource details successfully for azure sql server resource: $serverName with resource type: $ARMSqlServerResourceType" -Verbose

        $azureResourceGroupName = $azureSqlServerResourceDetails.ResourceGroupName
        return $azureSqlServerResourceDetails.ResourceGroupName
    }
    finally
    {
        if ([string]::IsNullOrEmpty($azureResourceGroupName))
        {
            Write-Verbose "(ARM)Sql Server: $serverName not found" -Verbose

            Throw (Get-LocalizedString -Key "Sql Database Server: '{0}' not found." -ArgumentList $serverName)
        }
    }
}

function Create-AzureSqlDatabaseServerFirewallRuleARM
{
    param([String] [Parameter(Mandatory = $true)] $startIPAddress,
          [String] [Parameter(Mandatory = $true)] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

     # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureSqlDatabaseServerRGName -serverName $serverName

    Write-Verbose "[Azure Platform Call] Creating firewall rule $firewallRuleName on azure database server: $serverName" -Verbose
    $azureSqlDatabaseServerFirewallRule = New-AzureRMSqlServerFirewallRule -ResourceGroupName $azureResourceGroupName -StartIPAddress $startIPAddress -EndIPAddress $endIPAddress -ServerName $serverName -FirewallRuleName $firewallRuleName -ErrorAction Stop
    Write-Verbose "[Azure Platform Call] Firewall rule $firewallRuleName created on azure database server: $serverName" -Verbose

    return $azureSqlDatabaseServerFirewallRule
}

function Delete-AzureSqlDatabaseServerFirewallRuleRDFE
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Write-Verbose "[Azure Platform Call] Deleting firewall rule $firewallRuleName on azure database server: $serverName" -Verbose
    Remove-AzureSqlDatabaseServerFirewallRule -ServerName $serverName -RuleName $firewallRuleName -Force -ErrorAction Stop | Out-Null
    Write-Verbose "[Azure Platform Call] Firewall rule $firewallRuleName deleted on azure database server: $serverName" -Verbose
}

function Delete-AzureSqlDatabaseServerFirewallRuleARM
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureSqlDatabaseServerRGName -serverName $serverName

    Write-Verbose "[Azure Platform Call] Deleting firewall rule $firewallRuleName on azure database server: $serverName" -Verbose
    Remove-AzureRMSqlServerFirewallRule -ResourceGroupName $azureResourceGroupName -ServerName $serverName -FirewallRuleName $firewallRuleName -Force -ErrorAction Stop | Out-Null
    Write-Verbose "[Azure Platform Call] Firewall rule $firewallRuleName deleted on azure database server: $serverName" -Verbose
}