$modelServerName = 'yyy.database.windows.net'
function Check-ServerName
{
    param([String] [Parameter(Mandatory = $true)] $serverName)

    if (-not $serverName.Contains('.'))
    {
        throw (Get-VstsLocString -Key "SAD_InvalidServerNameFormat" -ArgumentList $serverName, $modelServerName)
    }
}

function Get-AgentIPRange
{
    param(
        [String] $serverName,
        [String] $sqlUserName,
        [String] $sqlPassword
    )

    [hashtable] $IPRange = @{}

    $sqlCmd = Get-Command -Name "SqlCmd.exe" -ErrorAction SilentlyContinue
    if ($sqlCmd)
    {
        $sqlCmdArgs = "-S `"$serverName`" -U `"$sqlUsername`" -P `"$sqlPassword`" -Q `"select getdate()`""
    
        Write-Verbose "Reching SqlServer to check connection by running sqlcmd.exe $sqlCmdArgs"

        $ErrorActionPreference = 'Continue'

        $sqlCmdPath = $sqlCmd.Path
        ( Invoke-Expression "& '$sqlCmdPath' --% $sqlCmdArgs" -ErrorVariable errors -OutVariable output 2>&1 ) | Out-Null   

        $ErrorActionPreference = 'Stop'

        if($errors.Count -gt 0)
        {
            $errorMsg = $errors[0].ToString()
            Write-Verbose "Error Message: $errorMsg"

            $pattern = "([0-9]+).([0-9]+).([0-9]+)."
            $regex = New-Object  -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

            if($errorMsg.Contains("sp_set_firewall_rule") -eq $true -and $regex.IsMatch($errorMsg) -eq $true)
            {
                $ipRangePrefix = $regex.Match($errorMsg).Groups[0].Value;
                Write-Verbose "IP Range Prefix $ipRangePrefix"

                $IPRange.StartIPAddress = $ipRangePrefix + '0'
                $IPRange.EndIPAddress = $ipRangePrefix + '255'
            }
        }
    }
    else
    {
        Write-Verbose "SqlCmd.exe is not found in PATH" 

        $IPRange.StartIPAddress = Get-AgentStartIPAddress
        $IPRange.EndIPAddress = $IPRange.StartIPAddress
    }    

    return $IPRange
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

function Get-Endpoint
{
    param([String] [Parameter(Mandatory=$true)] $connectedServiceName)

    $serviceEndpoint = Get-VstsEndpoint -Name "$connectedServiceName"
    return $serviceEndpoint
}

function Create-AzureSqlDatabaseServerFirewallRule
{
    param([String] [Parameter(Mandatory = $true)] $startIp,
          [String] [Parameter(Mandatory = $true)] $endIp,
          [String] [Parameter(Mandatory = $true)] $serverName,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    [HashTable]$FirewallSettings = @{}
    $firewallRuleName = [System.Guid]::NewGuid().ToString()

    Add-AzureSqlDatabaseServerFirewallRule -endpoint $endpoint -startIPAddress $startIp -endIPAddress $endIp -serverName $serverName -firewallRuleName $firewallRuleName | Out-Null

    $FirewallSettings.IsConfigured = $true
    $FirewallSettings.RuleName = $firewallRuleName

    return $FirewallSettings
}

function Delete-AzureSqlDatabaseServerFirewallRule
{
    param([String] [Parameter(Mandatory = $true)] $serverName,
          [String] [Parameter(Mandatory = $true)] $firewallRuleName,
          [String] $isFirewallConfigured,
          [String] [Parameter(Mandatory = $true)] $deleteFireWallRule,
          [Object] [Parameter(Mandatory = $true)] $endpoint)

    if($deleteFireWallRule -eq "true" -and $isFirewallConfigured -eq "true")
    {
        Remove-AzureSqlDatabaseServerFirewallRule -serverName $serverName -firewallRuleName $firewallRuleName -endpoint $endpoint
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
            if ($serverName)
            {
                $serverNameSplittedArgs = $serverName.Trim().Split(".")
                if ($serverNameSplittedArgs.Length -gt 0)
                {
                    $sqlServerFirstName = $serverNameSplittedArgs[0]
                    if ((-not $sqlUsername.Trim().Contains("@" + $sqlServerFirstName)) -and $sqlUsername.Contains('@'))
                    {
                        $sqlUsername = $sqlUsername + "@" + $serverName 
                    }
                }
            }

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

function Execute-Command
{
    param(
        [String][Parameter(Mandatory=$true)] $FileName,
        [String][Parameter(Mandatory=$true)] $Arguments
    )

    $ErrorActionPreference = 'Continue' 
    Invoke-Expression "& '$FileName' --% $Arguments" 2>&1 -ErrorVariable errors | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            Write-Error $_
        } else {
            Write-Host $_
        }
    } 
    
    foreach($errorMsg in $errors){
        Write-Error $errorMsg
    }
    $ErrorActionPreference = 'Stop'
    if($LASTEXITCODE -ne 0)
    {
         throw  (Get-VstsLocString -Key "SAD_AzureSQLDacpacTaskFailed")
    }
}

function ConvertParamToSqlSupported
{
    param([String]$param)

    $param = $param.Replace('"', '\"')

    return $param
}

