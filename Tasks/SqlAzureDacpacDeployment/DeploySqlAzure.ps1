[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)] $ConnectedServiceName,
    [String] [Parameter(Mandatory = $true)] $DacpacFile,
    [String] [Parameter(Mandatory = $true)] $ServerName,
    [String] [Parameter(Mandatory = $true)] $DatabaseName,
    [String] $SqlUsername,
    [String] $SqlPassword,
    [String] $PublishProfile,
    [String] $AdditionalArguments,
    [String] [Parameter(Mandatory = $true)] $IpDetectionMethod,
    [String] $StartIpAddress,
    [String] $EndIpAddress,
    [String] [Parameter(Mandatory = $true)] $DeleteFirewallRule
)

Write-Verbose "Entering script DeploySqlAzure.ps1"


# Import the Task.Common dll that has all the cmdlets we need for Build
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal"

$ErrorActionPreference = 'Stop'

# ----------------------------------Log arguments-------------------------------------
Write-Verbose "DacpacFile= $DacpacFile" -Verbose
Write-Verbose "ServerName= $ServerName" -Verbose
Write-Verbose "DatabaseName= $DatabaseName" -Verbose
Write-Verbose "SqlUsername= $SqlUsername" -Verbose
Write-Verbose "PublishProfile= $PublishProfile" -Verbose
Write-Verbose "AdditionalArguments= $AdditionalArguments" -Verbose
Write-Verbose "StartIPAddress= $StartIPAddress" -Verbose
Write-Verbose "EndIPAddress= $EndIPAddress" -Verbose
Write-Verbose "DeleteFirewallRule= $DeleteFirewallRule" -Verbose


# ----------------Determine SQL Azure server name from connection string start----------

$serverFriendlyName = $ServerName.split(".")[0]   
Write-Verbose "Server friendly name is $serverFriendlyName" -Verbose

# ----------------Determine SQL Azure server name from connection string end----------


# ----------------Determine agent IP Address start----------------------

$firewallConfigured = $false
$firewallRuleName = ""
        
if($IpDetectionMethod -eq "IPAddressRange"){
    $startIp = $StartIpAddress
    $endIp = $EndIpAddress
}

if($IpDetectionMethod -eq "AutoDetect"){
    $connection = Get-VssConnection -TaskContext $distributedTaskContext
    $startIp = Get-ExternalIpAddress -Connection $connection
    $endIp = $startIp
}

# ----------------Determine agent IP Address end-------------------------

Try{
    
    # ---------------Configure firewall exceptions start-----------------------------
    
    if($startIp -and $endIp){
        $firewallRuleName = [System.Guid]::NewGuid()
        Write-Verbose "[Azure Platform Call] Creating firewall rule $firewallRuleName"  -Verbose
            
        New-AzureSqlDatabaseServerFirewallRule -StartIPAddress $startIp -EndIPAddress $endIp -RuleName $firewallRuleName -ServerName $serverFriendlyName
        
        Write-Verbose "[Azure Platform Call] Firewall rule $firewallRuleName created"  -Verbose
        $firewallConfigured = $true
    }   
    
    # ----------------Configure firewall exceptions end--------------------------------
    
    
    # ---------------Execute SQLPackage.exe start--------------------------------------
       
    $scriptArgument = Get-SqlPackageCommandArguments -dacpacFile $DacpacFile -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfile -additionalArguments $AdditionalArguments
    
    Write-Verbose "Created SQLPackage.exe agruments"  -Verbose
    
    $sqlDeploymentScriptPath = Join-Path "$env:AGENT_HOMEDIRECTORY" "Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\Scripts\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Sql.ps1"

    $SqlPackageCommand = "& `"$sqlDeploymentScriptPath`" $scriptArgument"
    
    Write-Verbose "Executing SQLPackage.exe"  -Verbose
    
    $ErrorActionPreference = 'Continue'

    Invoke-Expression -Command $SqlPackageCommand

    $ErrorActionPreference = 'Stop'
    
    # ---------------Execute SQLPackage.exe end------------------------------------ 
}
Finally{
    
    # --------------------Remove firewall exceptions start--------------------------
    
    if($firewallConfigured -and ($DeleteFirewallRule -eq "true")){
        Write-Verbose "[Azure Platform Call] Removing firewall rule $firewallRuleName"  -Verbose
        
        Remove-AzureSqlDatabaseServerFirewallRule -ServerName $serverFriendlyName -RuleName $firewallRuleName
        
        Write-Verbose "[Azure Platform Call] Firewall rule $firewallRuleName removed"  -Verbose
    }
    
    # --------------------Remove firewall exceptions end-----------------------------
}

Write-Verbose "Leaving script DeploySqlAzure.ps1"  -Verbose