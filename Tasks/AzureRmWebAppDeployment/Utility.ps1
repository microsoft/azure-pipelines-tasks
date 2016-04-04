$ErrorActionPreference = 'Stop'

function Get-MsDeployExePath
{
    $currentDir = (Get-Item -Path ".\" -Verbose).FullName

    $msDeployExeDir = Join-Path $currentDir "MSDeploy3.6"
    $msDeployExePath = Join-Path $msDeployExeDir "msdeploy.exe"
    Write-Verbose "msdeployExePath = $msDeployExePath" -Verbose

    return $msDeployExePath
}

function Get-MsDeployCmdArgs
{
    param([String][Parameter(Mandatory=$true)] $file,
          [String][Parameter(Mandatory=$true)] $webSiteName,
          [Object][Parameter(Mandatory=$true)] $azureRMWebsiteConnectionDetails,
          [String][Parameter(Mandatory=$true)] $removeAdditionalFilesFlag,
          [String][Parameter(Mandatory=$true)] $deleteFilesInAppDataFlag,
          [String][Parameter(Mandatory=$true)] $takeAppOfflineFlag,
          [String][Parameter(Mandatory=$false)] $physicalPath)

    $msDeployCmdArgs = [String]::Empty
    Write-Verbose "Constructing msdeploy command arguments to deploy to azureRM website: '$websiteName' from sourceFile: '$file'" -Verbose

    # msdeploy argument containing source and destination details to sync
    $msDeployCmdArgs = [String]::Format('-verb:sync -source:package="{0}" -dest:auto,ComputerName="https://{1}/msdeploy.axd?site={2}",UserName="{3}",Password="{4}",AuthType="Basic"' `
                                        , $file, $azureRMWebsiteConnectionDetails.KuduHostName, $webSiteName, $azureRMWebsiteConnectionDetails.UserName, $azureRMWebsiteConnectionDetails.UserPassword)

    # msdeploy argument to set destination IIS App Name for deploy
    if($physicalPath)
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}/{1}"', $webSiteName, $physicalPath)
    }
    else
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}"', $webSiteName)
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
    if($takeAppOfflineFlag -eq "true")
    {
        $msDeployCmdArgs += [String]::Format(' -skip:objectname="dirPath",absolutepath="{0}\\App_Data$"', $webSiteName)
    }

    Write-Verbose "Constructed msdeploy command arguments to deploy to azureRM website: '$websiteName' from sourceFile: '$file'" -Verbose
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

function Run-MsDeployCommand
{
    param([String][Parameter(Mandatory=$true)] $msDeployExePath,
          [String][Parameter(Mandatory=$true)] $msDeployCmdArgs)

    $msDeployCmd = "`"$msDeployExePath`" $msDeployCmdArgs"

    Write-Verbose "Running msdeploy command." -Verbose
    Run-Command -command $msDeployCmd
    Write-Verbose "msdeploy command ran successfully." -Verbose
}