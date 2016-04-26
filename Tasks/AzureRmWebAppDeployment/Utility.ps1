$ErrorActionPreference = 'Stop'

function Get-MsDeployExePath
{
    $currentDir = (Get-Item -Path ".\").FullName

    $msDeployExeDir = Join-Path $currentDir "MSDeploy3.6"
    $msDeployExePath = Join-Path $msDeployExeDir "msdeploy.exe"
    Write-Host (Get-LocalizedString -Key "msdeploy.exe is located at '{0}'" -ArgumentList $msDeployExePath)

    return $msDeployExePath
}

function Get-SingleFile
{
    param([String][Parameter(Mandatory=$true)] $files,
          [String][Parameter(Mandatory=$true)] $pattern)

    if ($files -is [system.array])
    {
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern {0}. There can be only one." -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-LocalizedString -Key "No files were found to deploy with search pattern {0}." -ArgumentList $pattern)
        }

        return $files
    }
}

function Get-SinglePackageFile
{
    param([String][Parameter(Mandatory=$true)] $package)

    Write-Host (Get-LocalizedString -Key "packageFile = Find-Files -SearchPattern {0}" -ArgumentList $package)
    $packageFile = Find-Files -SearchPattern $package
    Write-Host (Get-LocalizedString -Key "packageFile = {0}" -ArgumentList $packageFile)

    $packageFile = Get-SingleFile -files $packageFile -pattern $package
    return $packageFile
}

function Get-WebAppNameForMSDeployCmd
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSlotFlag,
          [String][Parameter(Mandatory=$false)] $slotName)

    $webAppNameForMSDeployCmd = $webAppName
    if($deployToSlotFlag -eq "true")
    {
        $webAppNameForMSDeployCmd += "(" + $SlotName + ")"
    }

    Write-Verbose "WebApp Name to be used in msdeploy command is: '$webAppNameForMSDeployCmd'"
    return $webAppNameForMSDeployCmd
}


function Get-MsDeployCmdArgs
{
    param([String][Parameter(Mandatory=$true)] $packageFile,
          [String][Parameter(Mandatory=$true)] $webAppNameForMSDeployCmd,
          [Object][Parameter(Mandatory=$true)] $azureRMWebAppConnectionDetails,
          [String][Parameter(Mandatory=$true)] $removeAdditionalFilesFlag,
          [String][Parameter(Mandatory=$true)] $excludeFilesFromAppDataFlag,
          [String][Parameter(Mandatory=$true)] $takeAppOfflineFlag,
          [String][Parameter(Mandatory=$false)] $virtualApplication,
          [String][Parameter(Mandatory=$false)] $AdditionalArguments)

    $msDeployCmdArgs = [String]::Empty
    Write-Verbose "Constructing msdeploy command arguments to deploy to azureRM WebApp:'$webAppNameForMSDeployCmd' `nfrom source Wep App zip package:'$packageFile'."

    # msdeploy argument containing source and destination details to sync
    $msDeployCmdArgs = [String]::Format('-verb:sync -source:package="{0}" -dest:auto,ComputerName="https://{1}/msdeploy.axd?site={2}",UserName="{3}",Password="{4}",AuthType="Basic"' `
                                        , $packageFile, $azureRMWebAppConnectionDetails.KuduHostName, $webAppNameForMSDeployCmd, $azureRMWebAppConnectionDetails.UserName, $azureRMWebAppConnectionDetails.UserPassword)

    # msdeploy argument to set destination IIS App Name for deploy
    if($virtualApplication)
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}/{1}"', $webAppNameForMSDeployCmd, $virtualApplication)
    }
    else
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}"', $webAppNameForMSDeployCmd)
    }

    # msdeploy argument to block deletion from happening
    if($removeAdditionalFilesFlag -ne "true")
    {
        $msDeployCmdArgs += " -enableRule:DoNotDeleteRule"
    }

    # msdeploy argument to take app offline
    if($takeAppOfflineFlag -eq "true")
    {
        $msDeployCmdArgs += " -enableRule:AppOffline"
    }

    # msdeploy argument to exclude files in App_Data folder
    if($excludeFilesFromAppDataFlag -eq "true")
    {
        $msDeployCmdArgs += [String]::Format(' -skip:objectname="dirPath",absolutepath="\\App_Data\\.*"')
    }

    # msploy additional arguments 
    if( -not [String]::IsNullOrEmpty($AdditionalArguments)){
        $msDeployCmdArgs += ( " " + $AdditionalArguments)
    }

    Write-Verbose "Constructed msdeploy command arguments to deploy to azureRM WebApp:'$webAppNameForMSDeployCmd' `nfrom source Wep App zip package:'$packageFile'."
    return $msDeployCmdArgs
}

function Run-Command
{
    param([String][Parameter(Mandatory=$true)] $command)

    try
	{
        if( $psversiontable.PSVersion.Major -le 4)
        {
           cmd.exe /c "`"$command`""
        }
        else
        {
           cmd.exe /c "$command"
        }

    }
	catch [System.Exception]
    {
        throw $_.Exception.Message    
    }

}

function Get-MsDeployCmdForLogs
{
    param([String][Parameter(Mandatory=$true)] $msDeployCmd)

    $msDeployCmdSplitByComma = $msDeployCmd.Split(',')
    $msDeployCmdHiddingSensitiveData = $msDeployCmdSplitByComma | ForEach-Object {if ($_.StartsWith("Password")) {$_.Replace($_, "Password=****")} else {$_}}

    $msDeployCmdForLogs = $msDeployCmdHiddingSensitiveData -join ","
    return $msDeployCmdForLogs
}

function Run-MsDeployCommand
{
    param([String][Parameter(Mandatory=$true)] $msDeployExePath,
          [String][Parameter(Mandatory=$true)] $msDeployCmdArgs)

    $msDeployCmd = "`"$msDeployExePath`" $msDeployCmdArgs"
    $msDeployCmdForLogs = Get-MsDeployCmdForLogs -msDeployCmd $msDeployCmd

    Write-Host (Get-LocalizedString -Key "Running msdeploy command: `n`t{0}" -ArgumentList $msDeployCmdForLogs)
    Run-Command -command $msDeployCmd
    Write-Host (Get-LocalizedString -Key "msdeploy command ran successfully.")
}