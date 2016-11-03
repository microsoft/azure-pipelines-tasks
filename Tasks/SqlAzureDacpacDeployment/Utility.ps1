function Get-AzureCmdletsVersion
{
    $module = Get-Module AzureRM -ListAvailable
    if($module)
    {
        return ($module).Version
    }
    return (Get-Module Azure -ListAvailable).Version
}

function Get-AzureVersionComparison($azureVersion, $compareVersion)
{
    Write-Verbose "Compare azure versions: $azureVersion, $compareVersion"
    return ($azureVersion -and $azureVersion -gt $compareVersion)
}

function Get-AgentStartIPAddress
{
    $endpoint = (Get-VstsEndpoint -Name SystemVssConnection -Require)
    $vssCredential = [string]$endpoint.auth.parameters.AccessToken

    $vssUri = $env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI
    if ($vssUri.IndexOf("visualstudio.com", [System.StringComparison]::OrdinalIgnoreCase) -ne -1) {
        # This hack finds the DTL uri for a hosted account. Note we can't support devfabric since the
        # there subdomain is not used for DTL endpoint
        $vssUri = $vssUri.Replace("visualstudio.com", "vsdtl.visualstudio.com")
    }

    Write-Verbose "Querying VSTS uri '$vssUri' to get external ip address"

    # Getting start ip address from dtl service
    Write-Verbose "Getting external ip address by making call to dtl service"
    $vssUri = $vssUri + "/_apis/vslabs/ipaddress"
    $username = ""
    $password = $vssCredential

    $basicAuth = ("{0}:{1}" -f $username, $password)
    $basicAuth = [System.Text.Encoding]::UTF8.GetBytes($basicAuth)
    $basicAuth = [System.Convert]::ToBase64String($basicAuth)
    $headers = @{Authorization=("Basic {0}" -f $basicAuth)}

    $response = Invoke-RestMethod -Uri $($vssUri) -headers $headers -Method Get -ContentType "application/json"
    Write-Verbose "Response: $response"

    return $response.Value
}

function Get-AgentIPAddress
{
    param([String] $startIPAddress,
          [String] $endIPAddress,
          [String] [Parameter(Mandatory = $true)] $ipDetectionMethod)

    [HashTable]$IPAddress = @{}
    if($ipDetectionMethod -eq "IPAddressRange")
    {
        $IPAddress.StartIPAddress = $startIPAddress
        $IPAddress.EndIPAddress = $endIPAddress
    }
    elseif($ipDetectionMethod -eq "AutoDetect")
    {
        $IPAddress.StartIPAddress = Get-AgentStartIPAddress
        $IPAddress.EndIPAddress = $IPAddress.StartIPAddress
    }

    return $IPAddress
}

function Get-AzureUtility
{
    $currentVersion =  Get-AzureCmdletsVersion
    Write-Verbose "Installed Azure PowerShell version: $currentVersion"

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

    Write-Verbose "Required AzureUtility: $azureUtilityRequiredVersion"
    return $azureUtilityRequiredVersion
}

function Get-ConnectionType
{
    param([String] [Parameter(Mandatory=$true)] $connectedServiceName)

    $serviceEndpoint = Get-VstsEndpoint -Name "$connectedServiceName"
    $connectionType = $serviceEndpoint.Auth.Scheme

    Write-Verbose "Connection type used is $connectionType"
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
            Delete-AzureSqlDatabaseServerFirewallRuleRDFE -serverName $serverName -firewallRuleName $firewallRuleName | Out-Null
        }
        else
        {
            Delete-AzureSqlDatabaseServerFirewallRuleARM -serverName $serverName -firewallRuleName $firewallRuleName | Out-Null
        }
    }
}

function Get-SqlPackageCommandArguments
{
    param([String] $dacpacFile,
          [String] $targetMethod,
          [String] $serverName,
          [String] $databaseName,
          [String] $sqlUsername,
          [String] $sqlPassword,
          [String] $connectionString,
          [String] $publishProfile,
          [String] $additionalArguments,
          [switch] $isOutputSecure)

    $ErrorActionPreference = 'Stop'
    $dacpacFileExtension = ".dacpac"
    $SqlPackageOptions =
    @{
        SourceFile = "/SourceFile:"; 
        Action = "/Action:"; 
        TargetServerName = "/TargetServerName:";
        TargetDatabaseName = "/TargetDatabaseName:";
        TargetUser = "/TargetUser:";
        TargetPassword = "/TargetPassword:";
        TargetConnectionString = "/TargetConnectionString:";
        Profile = "/Profile:";
    }

    # validate dacpac file
    if([System.IO.Path]::GetExtension($dacpacFile) -ne $dacpacFileExtension)
    {
        Write-Error (Get-VstsLocString -Key "SAD_InvalidDacpacFile" -ArgumentList $dacpacFile)
    }

    $sqlPackageArguments = @($SqlPackageOptions.SourceFile + "`"$dacpacFile`"")
    $sqlPackageArguments += @($SqlPackageOptions.Action + "Publish")

    if($targetMethod -eq "server")
    {
        $sqlPackageArguments += @($SqlPackageOptions.TargetServerName + "`"$serverName`"")
        if($databaseName)
        {
            $sqlPackageArguments += @($SqlPackageOptions.TargetDatabaseName + "`"$databaseName`"")
        }

        if($sqlUsername)
        {
            $sqlPackageArguments += @($SqlPackageOptions.TargetUser + "`"$sqlUsername`"")
            if(-not($sqlPassword))
            {
                Write-Error (Get-VstsLocString -Key "SAD_NoPassword" -ArgumentList $sqlUserName)
            }

            if( $isOutputSecure ){
                $sqlPassword = "********"
            } 
            else
            {
                $sqlPassword = ConvertParamToSqlSupported $sqlPassword
            }
            
            $sqlPackageArguments += @($SqlPackageOptions.TargetPassword + "`"$sqlPassword`"")
        }
    }
    elseif($targetMethod -eq "connectionString")
    {
        $sqlPackageArguments += @($SqlPackageOptions.TargetConnectionString + "`"$connectionString`"")
    }

    if($publishProfile)
    {
        # validate publish profile
        if([System.IO.Path]::GetExtension($publishProfile) -ne ".xml")
        {
            Write-Error (Get-VstsLocString -Key "SAD_InvalidPublishProfile" -ArgumentList $publishProfile)
        }
        $sqlPackageArguments += @($SqlPackageOptions.Profile + "`"$publishProfile`"")
    }

    $sqlPackageArguments += @("$additionalArguments")
    $scriptArgument = ($sqlPackageArguments -join " ") 

    return $scriptArgument
}

function Run-Command
{
    param([String][Parameter(Mandatory=$true)] $command)

    try
	{
        if( $psversiontable.PSVersion.Major -le 4)
        {
           cmd.exe /c "`"$command`"" 2>&1
        }
        else
        {
           cmd.exe /c "$command" 2>&1
        }

        if ($LastExitCode -ne 0)
        {
            throw [System.Management.Automation.RuntimeException] "$command failed with exit code $LastExitCode"
        }
    }
	catch [System.Exception]
    {
        Write-Verbose $_.Exception
        throw $_.Exception
    }
}

function ConvertParamToSqlSupported
{
    param([String]$param)

    $param = $param.Replace('"', '\"')

    return $param
}

