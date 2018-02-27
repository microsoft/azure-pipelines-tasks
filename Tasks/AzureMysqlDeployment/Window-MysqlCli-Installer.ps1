################################################################################
##  File:  Install-MysqlCli.ps1
##  Team:  ReleaseManagement
##  Desc:  Install Mysql CLI
################################################################################

# Install exe through url 
function Install-EXE
{
    Param
    (
        [String]$Url,
        [String]$Name,
        [String[]]$ArgumentList
    )

    $exitCode = -1

    try
    {
        Write-Host "Downloading $Name..."
        $FilePath = "${env:Temp}\$Name"

        Invoke-WebRequest -Uri $Url -OutFile $FilePath

        Write-Host "Starting Install $Name..."
        $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -Wait -PassThru
        $exitCode = $process.ExitCode

        if ($exitCode -eq 0 -or $exitCode -eq 3010)
        {
            Write-Host -Object 'Installation successful'
            return $exitCode
        }
        else
        {
            Write-Host -Object "Non zero exit code returned by the installation process : $exitCode."
            return $exitCode
        }
    }
    catch
    {
        Write-Host -Object "Failed to install the Executable $Name"
        Write-Host -Object $_.Exception.Message
        return -1
    }
}

# Set new machine path 
function Set-MachinePath{
    [CmdletBinding()]
    param(
        [string]$NewPath
    )
    Set-ItemProperty -Path 'Registry::HKEY_LOCAL_MACHINE\System\CurrentControlSet\Control\Session Manager\Environment' -Name Path -Value $NewPath
    return $NewPath
}

# Get machine path from registry
function Get-MachinePath{
    [CmdletBinding()]
    param(

    )
    $currentPath = (Get-ItemProperty -Path 'Registry::HKEY_LOCAL_MACHINE\System\CurrentControlSet\Control\Session Manager\Environment' -Name PATH).Path
    return $currentPath
}

# Append path of exe in existing path
function Add-MachinePathItem
{
    [CmdletBinding()]
    param(
        [string]$PathItem
    )

    $currentPath = Get-MachinePath
    $newPath = $PathItem + ';' + $currentPath
    return Set-MachinePath -NewPath $newPath
}

## Downloading mysql jar
$uri = 'https://dev.mysql.com/get/Downloads/MySQL-5.7/mysql-5.7.21-winx64.zip'
$mysqlPath = 'C:\mysql-5.7.21-winx64\bin'

# Installing visual c++ redistibutable package.
$InstallerURI = 'http://download.microsoft.com/download/0/5/6/056dcda9-d667-4e27-8001-8a0c6971d6b1/vcredist_x64.exe'
$InstallerName = 'vcredist_x64.exe'
$ArgumentList = ('/install', '/quiet', '/norestart' )

$exitCode = Install-EXE -Url $InstallerURI -Name $InstallerName -ArgumentList $ArgumentList
if ($exitCode -eq 0 -or $exitCode -eq 3010)
{
    # Get the latest mysql command line tools .
    Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile mysql.zip

    # Expand the zip
    Expand-Archive -Path mysql.zip -DestinationPath "C:\" -Force

    # Deleting zip folder
    Remove-Item -Recurse -Force mysql.zip

    # Adding mysql in system environment path
    Add-MachinePathItem $mysqlPath

    return 0;
}
else
{
    return $exitCode;
}