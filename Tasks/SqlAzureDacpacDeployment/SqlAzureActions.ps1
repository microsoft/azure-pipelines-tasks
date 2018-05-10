function Execute-SqlActions {
    param (
        [string] $DeploymentAction,
        [string] $AdditionalArguments
    )

    switch($DeploymentAction) {
        Publish { Publish-DacpacFile -AdditionalArguments $AdditionalArguments }
        Extract {}
        Export {}
        Import {}
        DriftReport {}
        Script {}
        DeployReport {}
    }
}

function Publish-DacpacFile {
    param(
        [string] $AdditionalArguments
    )
    
    # Increase Timeout to 120 seconds in case its not provided by User
    if (-not ($AdditionalArguments.ToLower().Contains("/targettimeout:") -or $AdditionalArguments.ToLower().Contains("/tt:")))
    {
        # Add Timeout of 120 Seconds
        $AdditionalArguments = $AdditionalArguments + " /TargetTimeout:$defaultTimeout"
    }

    # getting script arguments to execute sqlpackage.exe
    $scriptArgument = Get-SqlPackageCommandArguments -dacpacFile $FilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                    -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments

    $scriptArgumentToBeLogged = Get-SqlPackageCommandArguments -dacpacFile $FilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                    -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments -isOutputSecure

    Write-Verbose "sqlPackageArguments = $scriptArgumentToBeLogged"

    $SqlPackagePath = Get-SqlPackageOnTargetMachine

    Write-Verbose "Executing SQLPackage.exe"

    $SqlPackageCommand = "`"$SqlPackagePath`" $scriptArgument"
    $commandToBeLogged = "`"$SqlPackagePath`" $scriptArgumentToBeLogged"

    Write-Verbose "Executing : $commandToBeLogged"

    Execute-Command -FileName $SqlPackagePath -Arguments $scriptArgument
}

function Extract-DacpacFile {

}

function Import-DacpacFile {

}

function Export-DacpacFile {

}

function Drift-Report {

}

function Deploy-Report {

}

function Script-Action {

}

function Add-FirewallRule {

}