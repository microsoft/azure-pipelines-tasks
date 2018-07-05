$modelServerName = 'yyy.database.windows.net'
function Check-ServerName
{
    param([String] [Parameter(Mandatory = $true)] $serverName)

    if (-not $serverName.Contains('.'))
    {
        throw (Get-VstsLocString -Key "SAD_InvalidServerNameFormat" -ArgumentList $serverName, $modelServerName)
    }
}

function Get-FormattedSqlUsername
{
    param(
        [String] $sqlUserName,
        [String] $serverName
    )

    if ($serverName)
    {
        $serverName = ($serverName -replace "tcp:" -split "," )[0]

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

    return $sqlUsername
}

function Get-AgentIPRange
{
    param(
        [String] $serverName,
        [String] $sqlUserName,
        [String] $sqlPassword
    )

    [hashtable] $IPRange = @{}

    $formattedSqlUsername = $sqlUserName

    if($sqlUserName)
    {
        $formattedSqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUserName -serverName $serverName
    }

	if (Get-Command -Name "Invoke-Sqlcmd" -ErrorAction SilentlyContinue)
	{
		try {
			Write-Verbose "Reaching SqlServer to check connection by running Invoke-SqlCmd"
			Write-Verbose "Invoke-Sqlcmd -ServerInstance $serverName -Username $formattedSqlUsername -Password ****** -Query `"select getdate()`" -ErrorVariable errors -ConnectionTimeout 120 | Out-String"

			$output = Invoke-Sqlcmd -ServerInstance $serverName -Username $formattedSqlUsername -Password $sqlPassword -Query "select getdate()" -ErrorVariable errors -ConnectionTimeout 120 | Out-String
		}
		catch {
			Write-Verbose "Failed to reach SQL server $serverName. $($_.Exception.Message)"
		}
	}
	else 
	{
		$sqlCmd = Join-Path -Path $PSScriptRoot -ChildPath "sqlcmd\SQLCMD.exe"
		$env:SQLCMDPASSWORD = $sqlPassword

		$sqlCmdArgs = "-S `"$serverName`" -U `"$formattedSqlUsername`" -Q `"select getdate()`""

		Write-Verbose "Reaching SqlServer to check connection by running sqlcmd.exe $sqlCmdArgs"    

		$ErrorActionPreference = 'Continue'

		$output = ( Invoke-Expression "& '$sqlCmd' --% $sqlCmdArgs" -ErrorVariable errors 2>&1 ) | Out-String
	
		$ErrorActionPreference = 'Stop'
	}
    
    if($errors.Count -gt 0)
    {
        $errMsg = $errors[0].ToString()
        Write-Verbose "Error Message : $errMsg"
        $output = $errMsg
    }

    if($output)
    {
        Write-Verbose "Message To Parse: $output"

        $pattern = "([0-9]+)\.([0-9]+)\.([0-9]+)\."
        $regex = New-Object  -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

        if($output.Contains("sp_set_firewall_rule") -eq $true -and $regex.IsMatch($output) -eq $true)
        {
            $ipRangePrefix = $regex.Match($output).Groups[0].Value;
            Write-Verbose "IP Range Prefix $ipRangePrefix"

            $IPRange.StartIPAddress = $ipRangePrefix + '0'
            $IPRange.EndIPAddress = $ipRangePrefix + '255'
        }
    }

    return $IPRange
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
    param(
        [String] $sqlpackageAction,
        [String] $targetMethod,
        [String] $sourceFile,
        [String] $targetFile,
        [String] $sourceServerName,
        [String] $sourceDatabaseName,
        [String] $targetServerName,
        [String] $targetDatabaseName,
        [String] $sourceUser,
        [String] $sourcePassword,
        [String] $targetUser,
        [String] $targetPassword,
        [String] $connectionString,
        [String] $publishProfile,
        [String] $outputPath,
        [String] $additionalArguments,
        [Switch] $isOutputSecure
    )

    $ErrorActionPreference = 'Stop'

    $sqlPackageOptions =
    @{
        SourceFile = "/SourceFile:"; 
        Action = "/Action:"; 
        TargetServerName = "/TargetServerName:";
        TargetDatabaseName = "/TargetDatabaseName:";
        TargetUser = "/TargetUser:";
        TargetPassword = "/TargetPassword:";
        TargetConnectionString = "/TargetConnectionString:";
        Profile = "/Profile:";
        SourceServerName = "/SourceServerName:";
        SourceDatabaseName = "/SourceDatabaseName:";
        SourceUser = "/SourceUser:";
        SourcePassword = "/SourcePassword:";
        TargetFile = "/TargetFile:";
        OutputPath = "/OutputPath:";
    }

    $sqlPackageArguments = @("$($sqlPackageOptions.Action)$sqlpackageAction")
    
    if ($sourceFile) {
        $sqlPackageArguments += @("$($sqlPackageOptions.SourceFile)`"$sourceFile`"")
    }

    if ($targetFile) {
        $sqlPackageArguments += @("$($sqlPackageOptions.TargetFile)`"$targetFile`"")
    }

    if ($targetMethod -eq "server") {
        if ($sourceServerName -and $sourceDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.SourceServerName)`"$sourceServerName`"", 
                                      "$($sqlPackageOptions.SourceDatabaseName)`"$sourceDatabaseName`"")
        }

        if ($targetServerName -and $targetDatabaseName) {
            $sqlPackageArguments += @("$($sqlPackageOptions.TargetServerName)`"$targetServerName`"", 
                                      "$($sqlPackageOptions.TargetDatabaseName)`"$targetDatabaseName`"")
        }

        $sqlUsername = ""
        $sqlPassword = ""
        if ($sourceUser -and $sourcePassword) {
            $sqlUsername = $sourceUser
            $sqlPassword = $sourcePassword
        }

        if ($targetUser -and $targetPassword) {
            $sqlUsername = $targetUser
            $sqlPassword = $targetPassword
        }

        if ($sqlUsername) {
            $sqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsername -serverName $serverName
            if(-not($sqlPassword)) {
                Write-Error (Get-VstsLocString -Key "SAD_NoPassword" -ArgumentList $sqlUserName)
            }

            if ($isOutputSecure) {
                $sqlPassword = "********"
            } 
            else {
                $sqlPassword = ConvertParamToSqlSupported $sqlPassword
            }

            if ($sourceUser -and $sourcePassword) {
                $sqlPackageArguments += @("$($sqlPackageOptions.SourceUser)`"$sqlUsername`"",
                                          "$($sqlPackageOptions.SourcePassword)`"$sqlPassword`"")
            }

            if ($targetUser -and $targetPassword) {
                $sqlPackageArguments += @("$($sqlPackageOptions.TargetUser)`"$sqlUsername`"",
                                          "$($sqlPackageOptions.TargetPassword)`"$sqlPassword`"")
            }
        }
    }
    elseif ($targetMethod -eq "connectionString") { 
        # check this for extract and export
        $sqlPackageArguments += @("$($sqlPackageOptions.TargetConnectionString)`"$connectionString`"")
    }
    

    if ($publishProfile) {
        # validate publish profile
        if ([System.IO.Path]::GetExtension($publishProfile) -ne ".xml") {
            Write-Error (Get-VstsLocString -Key "SAD_InvalidPublishProfile" -ArgumentList $publishProfile)
        }

        $sqlPackageArguments += @("$($sqlPackageOptions.Profile)`"$publishProfile`"")
    }

    if ($outputPath) {
        $sqlPackageArguments += @("$($sqlPackageOptions.OutputPath)`"$outputPath`"")
    }

    # not supported in Extract Export
    $defaultTimeout = 120
    if (-not ($sqlpackageAction -eq "Extract" -or $sqlpackageAction -eq "Export") -and -not ($additionalArguments.ToLower().Contains("/targettimeout:") -or $additionalArguments.ToLower().Contains("/tt:"))) {
        # Add Timeout of 120 Seconds
        $additionalArguments = $additionalArguments + " /TargetTimeout:$defaultTimeout"
    }

    $sqlPackageArguments += @("$additionalArguments")
    $scriptArgument = $sqlPackageArguments -join " " 

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
         throw  (Get-VstsLocString -Key "SAD_AzureSQLDacpacTaskFailed" -ArgumentList $LASTEXITCODE)
    }
}

function ConvertParamToSqlSupported
{
    param([String]$param)

    $param = $param.Replace('"', '\"')

    return $param
}

# Function to import SqlPS module & avoid directory switch
function Import-Sqlps {
    Push-Location
    Import-Module SqlPS -ErrorAction 'SilentlyContinue' 3>&1 | Out-Null
    Pop-Location
}