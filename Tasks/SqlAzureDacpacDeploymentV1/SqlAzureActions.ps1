function Extract-Dacpac {
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    $targetDacpacFilePath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\$databaseName.dacpac"

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Extract" -targetFile $targetDacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -sourceConnectionString $connectionString -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Extract" -targetFile $targetDacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -sourceConnectionString $connectionString -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged

    Write-Host (Get-VstsLocString -Key "SAD_GeneratedFile" -ArgumentList "$targetDacpacFilePath")
    Write-Host "##vso[task.uploadfile]$targetDacpacFilePath"
    Write-Host (Get-VstsLocString -Key "SAD_SetOutputVariable" -ArgumentList "SqlDeploymentOutputFile", $targetDacpacFilePath)
    Write-Host "##vso[task.setVariable variable=SqlDeploymentOutputFile]$targetDacpacFilePath"
}

function Export-Bacpac {
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    $targetBacpacFilePath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\$databaseName.bacpac"

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Export" -targetFile $targetBacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -sourceConnectionString $connectionString -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Export" -targetFile $targetBacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -sourceConnectionString $connectionString -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged

    Write-Host (Get-VstsLocString -Key "SAD_GeneratedFile" -ArgumentList "$targetBacpacFilePath")
    Write-Host "##vso[task.uploadfile]$targetBacpacFilePath"
    Write-Host (Get-VstsLocString -Key "SAD_SetOutputVariable" -ArgumentList "SqlDeploymentOutputFile", $targetBacpacFilePath)
    Write-Host "##vso[task.setVariable variable=SqlDeploymentOutputFile]$targetBacpacFilePath"
}

function Import-Bacpac {
    param (
        [string] $bacpacFile,
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    $bacpacFilePath = Find-SqlFiles -filePathPattern $bacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_BacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Import" -sourceFile $bacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Import" -sourceFile $bacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword  -targetConnectionString $connectionString -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged
}

function Deploy-Report {
    param (
        [string] $dacpacFile,
        [string] $publishProfile,
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    $dacpacFilePath = Find-SqlFiles -filePathPattern $dacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_DacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    # Publish profile path validations - Ensure that only one publish profile file is found
    $publishProfilePath = ""
    if ([string]::IsNullOrWhitespace($publishProfile) -eq $false -and $publishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $publishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        $publishProfilePath = Find-SqlFiles -filePathPattern $publishProfile -verboseMessage (Get-VstsLocString -Key "SAD_PublishProfilePath") -throwIfMultipleFilesOrNoFilePresent
    }

    $outputXmlPath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\${databaseName}_DeployReport.xml"

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "DeployReport" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "DeployReport" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged

    Write-Host (Get-VstsLocString -Key "SAD_GeneratedFile" -ArgumentList "$outputXmlPath")
    Write-Host "##vso[task.uploadfile]$outputXmlPath"
    Write-Host (Get-VstsLocString -Key "SAD_SetOutputVariable" -ArgumentList "SqlDeploymentOutputFile", $outputXmlPath)
    Write-Host "##vso[task.setVariable variable=SqlDeploymentOutputFile]$outputXmlPath"
}

function Drift-Report {
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    $outputXmlPath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\${databaseName}_DriftReport.xml"

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "DriftReport" -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "DriftReport" -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged

    Write-Host (Get-VstsLocString -Key "SAD_GeneratedFile" -ArgumentList "$outputXmlPath")
    Write-Host "##vso[task.uploadfile]$outputXmlPath"
    Write-Host (Get-VstsLocString -Key "SAD_SetOutputVariable" -ArgumentList "SqlDeploymentOutputFile", $outputXmlPath)
    Write-Host "##vso[task.setVariable variable=SqlDeploymentOutputFile]$outputXmlPath"
}

function Script-Action {
    param (
        [string] $dacpacFile,
        [string] $publishProfile,
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    $dacpacFilePath = Find-SqlFiles -filePathPattern $dacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_DacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    # Publish profile path validations - Ensure that only one publish profile file is found
    $publishProfilePath = ""
    if ([string]::IsNullOrWhitespace($publishProfile) -eq $false -and $publishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $publishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        $publishProfilePath = Find-SqlFiles -filePathPattern $publishProfile -verboseMessage (Get-VstsLocString -Key "SAD_PublishProfilePath") -throwIfMultipleFilesOrNoFilePresent
    }

    $outputSqlPath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\${databaseName}_Script.sql"

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Script" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -outputPath $outputSqlPath -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Script" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -outputPath $outputSqlPath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged

    Write-Host (Get-VstsLocString -Key "SAD_GeneratedFile" -ArgumentList "$outputSqlPath")
    Write-Host "##vso[task.uploadfile]$outputSqlPath"
    Write-Host (Get-VstsLocString -Key "SAD_SetOutputVariable" -ArgumentList "SqlDeploymentOutputFile", $outputSqlPath)
    Write-Host "##vso[task.setVariable variable=SqlDeploymentOutputFile]$outputSqlPath"
}

function Publish-Dacpac {
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $dacpacFile,
        [string] $publishProfile,
        [string] $sqlpackageAdditionalArguments,
        [string] $token
    )

    #Ensure that a single package (.dacpac) file is found
    $dacpacFilePath = Find-SqlFiles -filePathPattern $dacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_DacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    # Publish profile path validations - Ensure that only one publish profile file is found
    $publishProfilePath = ""
    if ([string]::IsNullOrWhitespace($publishProfile) -eq $false -and $publishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $publishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        $publishProfilePath = Find-SqlFiles -filePathPattern $publishProfile -verboseMessage (Get-VstsLocString -Key "SAD_PublishProfilePath") -throwIfMultipleFilesOrNoFilePresent
    }

    $sqlpackageArguments = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments -token $token

    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -authenticationType $authenticationType -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -targetConnectionString $connectionString -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure -token $token

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged
}

function Run-SqlFiles {
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlFile,
        [string] $sqlcmdAdditionalArguments,
        [string] $token
    )

    #Ensure that a single .sql file is found
    $sqlFilePath = Find-SqlFiles -filePathPattern $sqlFile -verboseMessage "Sql file:" -throwIfMultipleFilesOrNoFilePresent

    if ([System.IO.Path]::GetExtension($sqlFilePath) -ne ".sql") {
        Write-Error (Get-VstsLocString -Key "SAD_InvalidSqlFile" -ArgumentList $FilePath)
    }

    Run-SqlCmd -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -connectionString $connectionString -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments -token $token
}

function Run-InlineSql {
    [CmdletBinding()]
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $connectionString,
        [string] $sqlInline,
        [string] $sqlcmdAdditionalArguments,
        [string] $token
    )

    $sqlInlineFilePath = [System.IO.Path]::GetTempFileName()
    $sqlInline | Out-File $sqlInlineFilePath

    Write-Host (Get-VstsLocString -Key "SAD_TemporaryInlineSqlFile" -ArgumentList $sqlInlineFilePath)

    try {
        Run-SqlCmd -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlInlineFilePath -connectionString $connectionString -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments -token $token
    }
    finally {
        if (Test-Path -Path $sqlInlineFilePath) {
            Write-Verbose "Removing File $sqlInlineFilePath"
            Remove-Item $sqlInlineFilePath -ErrorAction 'SilentlyContinue'
        }
    }
}

function Run-SqlCmd {
    [CmdletBinding()]
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $authenticationType,
        [string] $ConnectionString,
        [string] $sqlFilePath,
        [string] $sqlcmdAdditionalArguments,
        [string] $token
    )

    $sqlPassword = EscapeSpecialChars -str $sqlPassword

    if ($authenticationType -eq "server") {

        if ($sqlUsername) {
            $sqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsername -serverName $serverName
        }

        $scriptArgument = "Invoke-Sqlcmd -ServerInstance `"$serverName`" -Database `"$databaseName`" -Username `"$sqlUsername`" "

        $commandToRun = $scriptArgument + " -Password `"$sqlPassword`" "
        $commandToLog = $scriptArgument + " -Password ****** "

        # Increase Timeout to 120 seconds in case its not provided by User
        if (-not ($sqlcmdAdditionalArguments.ToLower().Contains("-connectiontimeout"))) {
            # Add Timeout of 120 Seconds
            $sqlcmdAdditionalArguments = $sqlcmdAdditionalArguments + " -ConnectionTimeout 120"
        }
    }
    elseif ($authenticationType -eq "connectionString") {
        Check-ConnectionString
        $connectionString = EscapeSpecialChars -str $connectionString
        $commandToRun = "Invoke-Sqlcmd -connectionString `"$connectionString`" "
        $commandToLog = "Invoke-Sqlcmd -connectionString `"**********`" "
    }
    elseif ($authenticationType -eq "aadAuthenticationPassword" -or $authenticationType -eq "aadAuthenticationIntegrated") {
        Check-connectionString
        $connectionString = Get-AADAuthenticationConnectionString -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUserName $sqlUserName -sqlPassword $sqlPassword
        $commandToRun = "Invoke-Sqlcmd -connectionString `"$connectionString`" "
        $commandToLog = "Invoke-Sqlcmd -connectionString `"**********`" "
    }
    elseif ($authenticationType -eq "servicePrincipal") {
        $commandToRun = "Invoke-Sqlcmd -AccessToken `"$token`" -ServerInstance `"$serverName`" -Database `"$databaseName`" "
        $commandToLog = "Invoke-Sqlcmd -AccessToken `"**********`" -ServerInstance `"$serverName`" -Database `"$databaseName`" "

    }

    $commandToRun += " -Inputfile `"$sqlFilePath`" " + $sqlcmdAdditionalArguments
    $commandToLog += " -Inputfile `"$sqlFilePath`" " + $sqlcmdAdditionalArguments

    Write-Host $commandToLog

    if ($sqlcmdAdditionalArguments.ToLower().Contains("-verbose")) {
        $ErrorActionPreference = 'Continue'
        
        (Invoke-Expression $commandToRun -ErrorVariable errors 4>&1) | Out-String | foreach-object { $_ }
        
        if ($errors.Count -gt 0) {
            throw $errMsg
        }
        
        $ErrorActionPreference = 'Stop'
    }
    else {
        Invoke-Expression $commandToRun
    }
}

function Check-ConnectionString {
    if (-not (CmdletHasMember -cmdlet Invoke-SQlCmd -memberName "connectionString")) {
        throw (Get-VstsLocString -Key "SAD_InvokeSQLCmdNotSupportingConnectionString")
    }
}

function Get-AgentIPRange {
    param(
        [String] $authenticationType,
        [String] $serverName,
        [String] $sqlUserName,
        [String] $sqlPassword,
        [String] $databaseName,
        [String] $connectionString,
        [String] $token
    )

    [hashtable] $IPRange = @{}

    if (Get-Command -Name "Invoke-Sqlcmd" -ErrorAction SilentlyContinue) {
        try {
            Write-Verbose "Reaching SqlServer to check connection by running Invoke-SqlCmd"
            Write-Verbose "Run-InlineSql -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUserName $sqlUserName -sqlPassword $sqlPassword -sqlInline `"select getdate()`" -connectionString $connectionString -ErrorVariable errors -ConnectionTimeout 120 | Out-String"

            $output = Run-InlineSql -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUserName $sqlUserName -sqlPassword $sqlPassword -sqlInline "select getdate()" -connectionString $connectionString -token $token -ErrorVariable errors | Out-String
        }
        catch {
            Write-Verbose "Failed to reach SQL server $serverName. $($_.Exception.Message)"
        }
    }
    else {
        $sqlCmd = Join-Path -Path $PSScriptRoot -ChildPath "sqlcmd\SQLCMD.exe"
        $env:SQLCMDPASSWORD = $sqlPassword

        $sqlCmdArgs = "-S `"$serverName`" -U `"$formattedSqlUsername`" -Q `"select getdate()`""

        Write-Verbose "Reaching SqlServer to check connection by running sqlcmd.exe $sqlCmdArgs"

        $ErrorActionPreference = 'Continue'

        $output = ( Invoke-Expression "& '$sqlCmd' --% $sqlCmdArgs" -ErrorVariable errors 2>&1 ) | Out-String

        $ErrorActionPreference = 'Stop'
    }

    if ($errors.Count -gt 0) {
        $errMsg = $errors[0].ToString()
        Write-Verbose "Error Message : $errMsg"
        $output = $errMsg
    }

    if ($output) {
        Write-Verbose "Message To Parse: $output"

        $pattern = "([0-9]+)\.([0-9]+)\.([0-9]+)\."
        $regex = New-Object  -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

        if ($output.Contains("sp_set_firewall_rule") -eq $true -and $regex.IsMatch($output) -eq $true) {
            $ipRangePrefix = $regex.Match($output).Groups[0].Value;
            Write-Verbose "IP Range Prefix $ipRangePrefix"

            $IPRange.StartIPAddress = $ipRangePrefix + '0'
            $IPRange.EndIPAddress = $ipRangePrefix + '255'
        }
    }

    return $IPRange
}

function Add-FirewallRule {
    param (
        [object] $endpoint,
        [string] $authenticationType,
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $connectionString,
        [string] $ipDetectionMethod,
        [string] $startIPAddress,
        [string] $endIPAddress,
        [String] $token,
        [string] $connectedServiceNameARM,
        [string] $vstsAccessToken
    )

    # Test and get IPRange for autoDetect IpDetectionMethod
    $ipAddressRange = @{}
    if ($ipDetectionMethod -eq "AutoDetect") {
        $ipAddressRange = Get-AgentIPRange -authenticationType $authenticationType -serverName $serverName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -databaseName $databaseName -connectionString $connectionString -token $token
    }
    else {
        $ipAddressRange.StartIPAddress = $startIPAddress
        $ipAddressRange.EndIPAddress = $endIPAddress
    }

    Write-Verbose ($ipAddressRange | Format-List | Out-String)

    # creating firewall rule for agent on sql server, if it is not able to connect or iprange is selected
    if ($ipAddressRange.Count -ne 0) {
        $serverFriendlyName = $serverName.split(".")[0]

        $firewallSettings = Create-AzureSqlDatabaseServerFirewallRule -startIP $ipAddressRange.StartIPAddress -endIP $ipAddressRange.EndIPAddress `
            -serverName $serverFriendlyName -endpoint $endpoint -connectedServiceNameARM $connectedServiceNameARM -vstsAccessToken $vstsAccessToken
        Write-Verbose ($firewallSettings | Format-List | Out-String)

        $firewallRuleName = $firewallSettings.RuleName
        $isFirewallConfigured = $firewallSettings.IsConfigured
    }

    return $firewallRuleName, $isFirewallConfigured
}

function Find-SqlFiles {
    param (
        [string] $filePathPattern,
        [string] $verboseMessage,
        [switch] $throwIfMultipleFilesOrNoFilePresent
    )

    Write-Verbose "filePath = Find-VstsFiles LegacyPattern $filePathPattern"
    $filePath = Find-VstsFiles LegacyPattern $filePathPattern

    if ($throwIfMultipleFilesOrNoFilePresent) {
        ThrowIfMultipleFilesOrNoFilePresent -files $filePath -pattern $filePathPattern
    }

    Write-Host "$verboseMessage $filePath"

    return $filePath
}

function ThrowIfMultipleFilesOrNoFilePresent($files, $pattern) {
    if ($files -is [system.array]) {
        throw (Get-VstsLocString -Key "SAD_FoundMoreFiles" -ArgumentList $pattern)
    }
    else {
        if (!$files) {
            throw (Get-VstsLocString -Key "SAD_NoFilesMatch" -ArgumentList $pattern)
        }
    }
}

function Execute-SqlPackage {
    param (
        [string] $sqlpackageArguments,
        [string] $sqlpackageArgumentsToBeLogged
    )

    $sqlPackagePath = Get-SqlPackageOnTargetMachine
    Write-Host "`"$sqlpackagePath`" $sqlpackageArgumentsToBeLogged"

    Execute-Command -FileName $sqlPackagePath -Arguments $sqlpackageArguments
}
