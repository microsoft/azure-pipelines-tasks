param (
	[string]$VersionSpec
    )

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

$jdkVersion = ("jdk" + $VersionSpec)
$jdkMatchString = ('jdk*' + $VersionSpec + '*')
$extendedJavaHome = ('JAVA_HOME_' + $VersionSpec + '_X64')

Write-Host "Installing chocolatey"
$chocoExePath = 'C:\ProgramData\Chocolatey\bin'

if ($($env:Path).ToLower().Contains($($chocoExePath).ToLower())) {
    Write-Host "Chocolatey found in PATH, skipping install..."
}
else {
	# Add to system PATH
	$systemPath = [Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::Machine)
	$systemPath += ';' + $chocoExePath
	[Environment]::SetEnvironmentVariable("PATH", $systemPath, [System.EnvironmentVariableTarget]::Machine)

	# Update local process' path
	$userPath = [Environment]::GetEnvironmentVariable('Path', [System.EnvironmentVariableTarget]::User)
	if ($userPath) {
	    $env:Path = $systemPath + ";" + $userPath
	}
	else {
	    $env:Path = $systemPath
	}

	# Run the installer
	Invoke-Expression ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))

	# Turn off confirmation
	choco feature enable -n allowGlobalConfirmation

	# Install webpi
	choco install webpicmd -y	
}

Write-Host "Installing desired JDK"
choco install $jdkVersion -y

$currentPath = Get-MachinePath
$pathSegments = $currentPath.Split(';')
$newPathSegments = @()

foreach ($pathSegment in $pathSegments)
{
    if($pathSegment -notlike '*java*')
    {
        $newPathSegments += $pathSegment
    }
}

$javaVersionInstalls = Get-ChildItem -Path 'C:\Program Files\Java' -Filter $jdkMatchString | Sort-Object -Property Name -Descending | Select-Object -First 1
$latestJavaInstall = $javaVersionInstalls.FullName;


$newPath = [string]::Join(';', $newPathSegments)
$newPath = $latestJavaInstall + '\bin;' + $newPath

Write-Host "Setting system path to ${newPath}"
Set-MachinePath -NewPath $newPath

Write-Host "Setting JAVA_HOME to ${latestJavaInstall}"
setx JAVA_HOME $latestJavaInstall /M

Write-Host "Setting ${extendedJavaHome} to ${latestJavaInstall}"
setx $extendedJavaHome $latestJavaInstall /M