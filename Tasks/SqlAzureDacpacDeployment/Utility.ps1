function Get-AgentStartIPAddress
{
    param([Object] [Parameter(Mandatory = $true)] $taskContext)

    $connection = Get-VssConnection -TaskContext $taskContext

    # getting start ip address from dtl service
    Write-Verbose "Getting external ip address by making call to dtl service" -Verbose
    $startIP = Get-ExternalIpAddress -Connection $connection

    return $startIP
}

function Get-AgentIPAddress
{
    param([String] $startIPAddress,
          [String] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $ipDetectionMethod,
          [Object] [Parameter(Mandatory = $true)] $taskContext)

    [HashTable]$IPAddress = @{}
    if($ipDetectionMethod -eq "IPAddressRange")
    {
        $IPAddress.StartIPAddress = $startIPAddress
        $IPAddress.EndIPAddress = $endIPAddress
    }
    elseif($ipDetectionMethod -eq "AutoDetect")
    {
        $IPAddress.StartIPAddress = Get-AgentStartIPAddress -TaskContext $taskContext
        $IPAddress.EndIPAddress = $IPAddress.StartIPAddress
    }

    return $IPAddress
}

function Get-AzureUtility
{
    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose -Verbose "Installed Azure PowerShell version: $currentVersion"

    $minimumAzureVersion = New-Object System.Version(0, 9, 9)
    $versionCompatible = Get-AzureVersionComparison -AzureVersion $currentVersion -CompareVersion $minimumAzureVersion

    $azureUtilityOldVersion = "AzureUtilityLTE9.8.ps1"
    $azureUtilityNewVersion = "AzureUtilityGTE1.0.ps1"

    if(!$versionCompatible)
    {
        $azureUtilityRequiredVersion = $azureUtilityOldVersion
    }
    else
    {
        $azureUtilityRequiredVersion = $azureUtilityNewVersion
    }

    Write-Verbose -Verbose "Required AzureUtility: $azureUtilityRequiredVersion"
    return $azureUtilityRequiredVersion
}

function Get-ConnectionType
{
    param([String] [Parameter(Mandatory=$true)] $connectedServiceName,
          [Object] [Parameter(Mandatory=$true)] $taskContext)

    $serviceEndpoint = Get-ServiceEndpoint -Name "$ConnectedServiceName" -Context $taskContext
    $connectionType = $serviceEndpoint.Authorization.Scheme

    Write-Verbose -Verbose "Connection type used is $connectionType"
    return $connectionType
}

function Create-AzureSqlDatabaseServerFirewallRule
{
    param([String] [Parameter(Mandatory = $true)] $startIp,
          [String] [Parameter(Mandatory = $true)] $endIp,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $connectionType)

    [HashTable]$FirewallSettings = @{}
    $firewallRuleName = [System.Guid]::NewGuid().ToString()

    if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
    {
        Create-AzureSqlDatabaseServerFirewallRuleRDFE -startIPAddress $startIp -endIPAddress $endIp -serverName $serverName -firewallRuleName $firewallRuleName | Out-Null
    }
    else
    {
        Create-AzureSqlDatabaseServerFirewallRuleARM -startIPAddress $startIp -endIPAddress $endIp -serverName $serverName -firewallRuleName $firewallRuleName | Out-Null
    }

    $FirewallSettings.IsConfigured = $true
    $FirewallSettings.RuleName = $firewallRuleName

    return $FirewallSettings
}

function Delete-AzureSqlDatabaseServerFirewallRule
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] $firewallRuleName,
          [String] [Parameter(Mandatory = $true)] $connectionType,
          [String] $isFirewallConfigured,
          [String] [Parameter(Mandatory = $true)] $deleteFireWallRule)

    if($deleteFireWallRule -eq "true" -and $isFirewallConfigured -eq "true")
    {
        if($connectionType -eq 'Certificate' -or $connectionType -eq 'UserNamePassword')
        {
            Delete-AzureSqlDatabaseServerFirewallRuleRDFE -serverName $serverName -firewallRuleName $firewallRuleName
        }
        else
        {
            Delete-AzureSqlDatabaseServerFirewallRuleARM -serverName $serverName -firewallRuleName $firewallRuleName
        }
    }
}


