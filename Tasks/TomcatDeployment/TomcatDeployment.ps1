param(
    [string]$tomcatUrl,
    [string]$username,
    [string]$password,
    [string]$warfile,
    [string]$context,
    [string]$serverVersion
)

Write-Verbose "Entering script TomcatDeployment.ps1" -Verbose
Write-Verbose "tomcatUrl = $tomcatUrl" -Verbose
Write-Verbose "username = $username" -Verbose
Write-Verbose "warfile = $warfile" -Verbose
Write-Verbose "context = $context" -Verbose
Write-Verbose "serverVersion = $serverVersion" -Verbose

# halt execution at the failed command 
$ErrorActionPreference = 'Stop'

# Removing extra spaces 
$tomcatUrl = $tomcatUrl.Trim()
$context = $context.Trim()

# Import the Task dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

function ThrowError
{
    param([string]$errorMessage)

    $readmelink = "https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/TomcatDeployment/README.md"
    $helpMessage = (Get-LocalizedString -Key "For more info please refer to {0}" -ArgumentList $readmelink)
    throw "$errorMessage $helpMessage"
}

#Verify curl is installed correctly
try
{
    $curl = Get-Command curl.exe
    $curlPath = $curl.Path
    Write-Verbose "Found curl at $curlPath" -Verbose
}
catch
{
    $errorMessage = (Get-LocalizedString -Key 'Unable to find cURL. Verify it is installed correctly on the build agent: http://curl.haxx.se.')
    ThrowError -errorMessage $errorMessage
}

if(-not $context.StartsWith("/"))
{
    $errorMessage = (Get-LocalizedString -Key "Provided context name '{0}' is invalid. Context name should start with '/'." -ArgumentList $context)
    ThrowError -errorMessage $errorMessage
}

if($context -eq "/")
{
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($warfile)
    $context = "$context" + "$fileName"
}

if($serverVersion -eq "6.x")
{
    $url =  "$tomcatUrl" + "/manager/deploy" + "?path=" + "$context" + "&update=true"
}
else
{
    $url =  "$tomcatUrl" + "/manager/text/deploy" + "?path=" + "$context" + "&update=true"
}

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingString = $env:system_debug
if ($enableDetailedLoggingString -ne "true")
{
    $enableDetailedLoggingString = "false"
}

Write-Verbose "Final URL : '$url'" -Verbose

$args = "--stderr - -i --fail -u `"$username`"" + ":" + "`"$password`" -T $warfile `"$url`""

# enabling detailed logging
if($env:system_debug -eq "true")
{
     $args = "$args" + " -v"
}

Write-Output (Get-LocalizedString -Key "Starting deployment on tomcat server '{0}'" -ArgumentList $tomcatUrl)
Write-Verbose "Running curl..." -Verbose
Invoke-Tool -Path $curlPath -Arguments $args
Write-Verbose "Leaving script TomcatDeployment.ps1" -Verbose
