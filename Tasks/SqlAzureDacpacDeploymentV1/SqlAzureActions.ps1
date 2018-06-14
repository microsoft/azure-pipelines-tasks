function Extract-Dacpac {
    param (
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $sqlpackageAdditionalArguments
    )

    $targetDacpacFilePath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\$databaseName.dacpac"
    
    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Extract" -targetFile $targetDacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Extract" -targetFile $targetDacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure
    
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
        [string] $sqlpackageAdditionalArguments
    )

    $targetBacpacFilePath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\$databaseName.bacpac"

    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Export" -targetFile $targetBacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Export" -targetFile $targetBacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged

    Write-Host (Get-VstsLocString -Key "SAD_GeneratedFile" -ArgumentList "$targetBacpacFilePath")
    Write-Host "##vso[task.uploadfile] $targetBacpacFilePath"
    Write-Host (Get-VstsLocString -Key "SAD_SetOutputVariable" -ArgumentList "SqlDeploymentOutputFile", $targetBacpacFilePath)
    Write-Host "##vso[task.setVariable variable=SqlDeploymentOutputFile] $targetBacpacFilePath"
}

function Import-Bacpac {
    param (
        [string] $bacpacFile,   
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $sqlpackageAdditionalArguments
    )

    $bacpacFilePath = Find-SqlFiles -filePathPattern $bacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_BacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Import" -sourceFile $bacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Import" -sourceFile $bacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure

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
        [string] $sqlpackageAdditionalArguments
    )

    $dacpacFilePath = Find-SqlFiles -filePathPattern $dacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_DacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    # Publish profile path validations - Ensure that only one publish profile file is found
    $publishProfilePath = "" 
    if ([string]::IsNullOrWhitespace($publishProfile) -eq $false -and $publishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $publishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        $publishProfilePath = Find-SqlFiles -filePathPattern $publishProfile -verboseMessage (Get-VstsLocString -Key "SAD_PublishProfilePath") -throwIfMultipleFilesOrNoFilePresent
    }

    $outputXmlPath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\${databaseName}_DeployReport.xml"
    
    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "DeployReport" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "DeployReport" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure 

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
        [string] $sqlpackageAdditionalArguments
    )

    $outputXmlPath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\${databaseName}_DriftReport.xml"
    
    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "DriftReport" -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "DriftReport" -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure

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
        [string] $sqlpackageAdditionalArguments
    )

    $dacpacFilePath = Find-SqlFiles -filePathPattern $dacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_DacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    # Publish profile path validations - Ensure that only one publish profile file is found
    $publishProfilePath = "" 
    if ([string]::IsNullOrWhitespace($publishProfile) -eq $false -and $publishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $publishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        $publishProfilePath = Find-SqlFiles -filePathPattern $publishProfile -verboseMessage (Get-VstsLocString -Key "SAD_PublishProfilePath") -throwIfMultipleFilesOrNoFilePresent
    }

    $outputSqlPath = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles\${databaseName}_Script.sql"
    
    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Script" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputSqlPath -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Script" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputSqlPath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure

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
        [string] $dacpacFile,
        [string] $publishProfile,
        [string] $sqlpackageAdditionalArguments
    )
    
    #Ensure that a single package (.dacpac) file is found
    $dacpacFilePath = Find-SqlFiles -filePathPattern $dacpacFile -verboseMessage (Get-VstsLocString -Key "SAD_DacpacFilePath") -throwIfMultipleFilesOrNoFilePresent

    # Publish profile path validations - Ensure that only one publish profile file is found
    $publishProfilePath = "" 
    if ([string]::IsNullOrWhitespace($publishProfile) -eq $false -and $publishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $publishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\")) {
        $publishProfilePath = Find-SqlFiles -filePathPattern $publishProfile -verboseMessage (Get-VstsLocString -Key "SAD_PublishProfilePath") -throwIfMultipleFilesOrNoFilePresent
    }

    $sqlpackageArguments = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
    $sqlpackageArgumentsToBeLogged = Get-SqlPackageCommandArguments -targetMethod "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure

    Execute-SqlPackage -sqlpackageArguments $sqlpackageArguments -sqlpackageArgumentsToBeLogged $sqlpackageArgumentsToBeLogged
}

function Execute-PublishAction {
    param(
        [string] $serverName,
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $taskNameSelector,
        [string] $dacpacFile,
        [string] $publishProfile,
        [string] $sqlFile,
        [string] $sqlInline,
        [string] $sqlpackageAdditionalArguments,
        [string] $sqlcmdAdditionalArguments,
        [string] $sqlcmdInlineAdditionalArguments
    )

    switch ($taskNameSelector) {
        "DacpacTask" {
            Publish-Dacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -dacpacFile $dacpacFile -publishProfile $publishProfile -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        "SqlTask" {
            Run-SqlFiles -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFile $sqlFile -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments
        }
        "InlineSqlTask" {
            Run-InlineSql -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlInline $sqlInline -sqlcmdAdditionalArguments $sqlcmdInlineAdditionalArguments
        }
        default {
            throw Get-VstsLocString -Key "SAD_InvalidPublishOption" -ArgumentList $taskNameSelector
        }
    }
}

function Run-SqlFiles {
    param (
        [string] $serverName,    
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $sqlFile,
        [string] $sqlcmdAdditionalArguments
    )

    #Ensure that a single .sql file is found
    $sqlFilePath = Find-SqlFiles -filePathPattern $sqlFile -verboseMessage "Sql file:" -throwIfMultipleFilesOrNoFilePresent
    
    if ([System.IO.Path]::GetExtension($sqlFilePath) -ne ".sql") {
        Write-Error (Get-VstsLocString -Key "SAD_InvalidSqlFile" -ArgumentList $FilePath)
    }

    Run-SqlCmd -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlFilePath -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments
}

function Run-InlineSql {
    param (
        [string] $serverName,    
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $sqlInline,
        [string] $sqlcmdAdditionalArguments
    )

    $sqlInlineFilePath = [System.IO.Path]::GetTempFileName()
    $sqlInline | Out-File $sqlInlineFilePath

    Write-Host (Get-VstsLocString -Key "SAD_TemporaryInlineSqlFile" -ArgumentList $sqlInlineFilePath)

    try {
        Run-SqlCmd -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFilePath $sqlInlineFilePath -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments
    }
    finally {
        if (Test-Path -Path $sqlInlineFilePath) {
            Write-Verbose "Removing File $sqlInlineFilePath"
            Remove-Item $sqlInlineFilePath -ErrorAction 'SilentlyContinue'
        }
    }
}

function Run-SqlCmd {
    param (
        [string] $serverName,    
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $sqlFilePath,
        [string] $sqlcmdAdditionalArguments
    )

    if ($sqlUsername) {
        $sqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUsername -serverName $serverName
    }

    $scriptArgument = "Invoke-Sqlcmd -ServerInstance `"$serverName`" -Database `"$databaseName`" -Username `"$sqlUsername`" "

    $commandToRun = $scriptArgument + " -Password `"$sqlPassword`" "
    $commandToLog = $scriptArgument + " -Password ****** "

    # Increase Timeout to 120 seconds in case its not provided by User
    if (-not ($sqlcmdAdditionalArguments.ToLower().Contains("-connectiontimeout")))
    {
        # Add Timeout of 120 Seconds
        $sqlcmdAdditionalArguments = $sqlcmdAdditionalArguments + " -ConnectionTimeout 120"
    }

    $commandToRun += " -Inputfile `"$sqlFilePath`" " + $sqlcmdAdditionalArguments
    $commandToLog += " -Inputfile `"$sqlFilePath`" " + $sqlcmdAdditionalArguments

    Write-Host $commandToLog
    Invoke-Expression $commandToRun
}

function Add-FirewallRule {
    param (
        [object] $endpoint,
        [string] $serverName,    
        [string] $databaseName,
        [string] $sqlUsername,
        [string] $sqlPassword,
        [string] $ipDetectionMethod,
        [string] $startIPAddress,
        [string] $endIPAddress
    )
    
    # Test and get IPRange for autoDetect IpDetectionMethod
    $ipAddressRange = @{}
    if($ipDetectionMethod -eq "AutoDetect")
    {
        $ipAddressRange = Get-AgentIPRange -serverName $serverName -sqlUsername $sqlUsername -sqlPassword $sqlPassword
    }
    else 
    {
        $ipAddressRange.StartIPAddress = $startIPAddress
        $ipAddressRange.EndIPAddress = $endIPAddress
    }

    Write-Verbose ($ipAddressRange | Format-List | Out-String)

    # creating firewall rule for agent on sql server, if it is not able to connect or iprange is selected
    if($ipAddressRange.Count -ne 0)
    {
        $serverFriendlyName = $serverName.split(".")[0]
    
        $firewallSettings = Create-AzureSqlDatabaseServerFirewallRule -startIP $ipAddressRange.StartIPAddress -endIP $ipAddressRange.EndIPAddress -serverName $serverFriendlyName -endpoint $endpoint
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

function ThrowIfMultipleFilesOrNoFilePresent($files, $pattern)
{
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
