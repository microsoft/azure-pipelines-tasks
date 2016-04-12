$ErrorActionPreference = 'Stop'

function Get-MsDeployExePath
{
    $currentDir = (Get-Item -Path ".\").FullName

    $msDeployExeDir = Join-Path $currentDir "MSDeploy3.6"
    $msDeployExePath = Join-Path $msDeployExeDir "msdeploy.exe"
    Write-Host (Get-LocalizedString -Key "msdeploy.exe is located at '{0}'" -ArgumentList $msDeployExePath)

    return $msDeployExePath
}

function Get-WebAppNameForMSDeployCmd
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSpecificSlotFlag,
          [String][Parameter(Mandatory=$false)] $slotName)

    $webAppNameForMSDeployCmd = $WebAppName
    if($DeployToSpecificSlotFlag -eq "true")
    {
        $webAppNameForMSDeployCmd += "(" + $SlotName + ")"
    }

    Write-Host (Get-LocalizedString -Key "WebApp Name to be used in msdeploy command is: '{0}'" -ArgumentList $webAppNameForMSDeployCmd)
    return $webAppNameForMSDeployCmd
}

function Get-MsDeployCmdArgs
{
    param([String][Parameter(Mandatory=$true)] $file,
          [String][Parameter(Mandatory=$true)] $webAppNameForMSDeployCmd,
          [Object][Parameter(Mandatory=$true)] $azureRMWebAppConnectionDetails,
          [String][Parameter(Mandatory=$true)] $removeAdditionalFilesFlag,
          [String][Parameter(Mandatory=$true)] $deleteFilesInAppDataFlag,
          [String][Parameter(Mandatory=$true)] $takeAppOfflineFlag,
          [String][Parameter(Mandatory=$false)] $physicalPath)

    $msDeployCmdArgs = [String]::Empty
    Write-Host (Get-LocalizedString -Key "Constructing msdeply command arguments to deploy to azureRM WebApp:'{0}' from sourceFile:'{1}'." -ArgumentList $webAppNameForMSDeployCmd, $file)

    # msdeploy argument containing source and destination details to sync
    $msDeployCmdArgs = [String]::Format('-verb:sync -source:package="{0}" -dest:auto,ComputerName="https://{1}/msdeploy.axd?site={2}",UserName="{3}",Password="{4}",AuthType="Basic"' `
                                        , $file, $azureRMWebAppConnectionDetails.KuduHostName, $webAppNameForMSDeployCmd, $azureRMWebAppConnectionDetails.UserName, $azureRMWebAppConnectionDetails.UserPassword)

    # msdeploy argument to set destination IIS App Name for deploy
    if($physicalPath)
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}/{1}"', $webAppNameForMSDeployCmd, $physicalPath)
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

    # msdeploy argument to remove files in App_Data folder
    if($deleteFilesInAppDataFlag -eq "true")
    {
        $msDeployCmdArgs += [String]::Format(' -skip:objectname="dirPath",absolutepath="{0}\\App_Data$"', $webAppNameForMSDeployCmd)
    }

    Write-Host (Get-LocalizedString -Key "Constructed msdeploy command arguments to deploy to azureRM WebApp:'{0}' from sourceFile:'{1}'." -ArgumentList $webAppNameForMSDeployCmd, $file)
    return $msDeployCmdArgs
}

function Run-Command
{
    param([String][Parameter(Mandatory=$true)] $command,
          [bool][Parameter(Mandatory=$false)] $failOnErr = $true)

    $ErrorActionPreference = 'Continue'
    if( $psversiontable.PSVersion.Major -le 4)
    {
        $result = cmd.exe /c "`"$command`""
    }
    else
    {
        $result = cmd.exe /c "$command"
    }

    $ErrorActionPreference = 'Stop'
    if($failOnErr -and $LASTEXITCODE -ne 0)
    {
        throw $result
    }
    
    return $result
}

function Get-MsDeployCmdForLogs
{
    param([String][Parameter(Mandatory=$true)] $msDeployCmd)

    $msDeployCmdSplitByComma = $msDeployCmd.Split(',')
    $msDeployCmdHiddingSensitiveData = $msDeployCmdSplitByComma | ForEach-Object {if ($_.StartsWith("Password")) {$_.Replace($_, "Password=****")} else {$_}}

    $msDeployCmdForLogs = $msDeployCmdHiddingSensitiveData -join ",`n`t"
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