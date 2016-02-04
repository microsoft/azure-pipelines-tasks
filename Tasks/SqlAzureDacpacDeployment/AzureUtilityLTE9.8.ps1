# This file implements IAzureUtility for Azure PowerShell version <= 0.9.8

function Create-AzureSqlDatabaseServerFirewallRuleRDFE
{
    param([String] [Parameter(Mandatory = $true)] $startIPAddress,
          [String] [Parameter(Mandatory = $true)] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Switch-AzureMode AzureServiceManagement

    try
    {
        Write-Verbose "[Azure RDFE Call] Creating firewall rule $firewallRuleName"  -Verbose
        $azureSqlDatabaseServerFirewallRule = New-AzureSqlDatabaseServerFirewallRule -StartIPAddress $startIPAddress -EndIPAddress $endIPAddress -ServerName $serverName `
                                                                                     -RuleName $firewallRuleName -ErrorAction Stop
        Write-Verbose "[Azure RDFE Call] Firewall rule $firewallRuleName created"  -Verbose
    }
    catch [System.ServiceModel.CommunicationException]
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "ExceptionMessage: $exceptionMessage" -Verbose

        Throw (Get-LocalizedString -Key "Either IPAddress mentioned is not a valid IPv4 address or Sql database server: '{0}' does not exist." -ArgumentList $serverName)
    }

    return $azureSqlDatabaseServerFirewallRule
}

function Get-AzureSqlDatabaseServerRGName
{
    param([String] [Parameter(Mandatory = $true)] $serverName)

    $ARMSqlServerResourceType =  "Microsoft.Sql/servers"
    Switch-AzureMode AzureResourceManager

    try
    {
        Write-Verbose "[Azure RM Call] Getting resource details for azure sql server resource: $serverName with resource type: $ARMSqlServerResourceType" -Verbose
        $azureSqlServerResourceDetails = (Get-AzureResource -ResourceName $serverName -ErrorAction Stop) | Where-Object { $_.ResourceType -eq $ARMSqlServerResourceType }
        Write-Verbose "[Azure RM Call] Retrieved resource details successfully for azure sql server resource: $serverName with resource type: $ARMSqlServerResourceType" -Verbose

        $azureResourceGroupName = $azureSqlServerResourceDetails.ResourceGroupName
        return $azureSqlServerResourceDetails.ResourceGroupName
    }
    finally
    {
        if ([string]::IsNullOrEmpty($azureResourceGroupName))
        {
            Write-Verbose "[Azure RM Call] Sql Database Server: $serverName not found" -Verbose

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

    Switch-AzureMode AzureResourceManager

     # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureSqlDatabaseServerRGName -serverName $serverName
    Write-Verbose "For azure sql database server: '$serverName' resourcegroup name is '$azureResourceGroupName'." -Verbose

    try
    {
        Write-Verbose "[Azure RM Call] Creating firewall rule $firewallRuleName on azure database server: $serverName" -Verbose
        $azureSqlDatabaseServerFirewallRule = New-AzureSqlServerFirewallRule -ResourceGroupName $azureResourceGroupName -StartIPAddress $startIPAddress -EndIPAddress $endIPAddress -ServerName $serverName -FirewallRuleName $firewallRuleName -ErrorAction Stop
        Write-Verbose "[Azure RM Call] Firewall rule $firewallRuleName created on azure database server: $serverName" -Verbose
    }
    catch [Hyak.Common.CloudException]
    {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "ExceptionMessage: $exceptionMessage" -Verbose

        Throw (Get-LocalizedString -Key "IPAddress mentioned is not a valid IPv4 address.")
    }

    return $azureSqlDatabaseServerFirewallRule
}

function Delete-AzureSqlDatabaseServerFirewallRuleRDFE
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Switch-AzureMode AzureServiceManagement

    Write-Verbose "[Azure RDFE Call] Deleting firewall rule $firewallRuleName on azure database server: $serverName" -Verbose
    Remove-AzureSqlDatabaseServerFirewallRule -ServerName $serverName -RuleName $firewallRuleName -Force -ErrorAction Stop
    Write-Verbose "[Azure RDFE Call] Firewall rule $firewallRuleName deleted on azure database server: $serverName" -Verbose
}

function Delete-AzureSqlDatabaseServerFirewallRuleARM
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Switch-AzureMode AzureResourceManager

    # get azure storage account resource group name
    $azureResourceGroupName = Get-AzureSqlDatabaseServerRGName -serverName $serverName
    Write-Verbose "For azure sql database server: '$serverName' resourcegroup name is '$azureResourceGroupName'." -Verbose

    Write-Verbose "[Azure RM Call] Deleting firewall rule $firewallRuleName on azure database server: $serverName" -Verbose
    Remove-AzureSqlServerFirewallRule -ResourceGroupName $azureResourceGroupName -ServerName $serverName -FirewallRuleName $firewallRuleName -Force -ErrorAction Stop
    Write-Verbose "[Azure RM Call] Firewall rule $firewallRuleName deleted on azure database server: $serverName" -Verbose
}