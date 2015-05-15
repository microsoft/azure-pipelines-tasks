param(
    [string]$files,
    [string]$username,
    [string]$password,
    [string]$url,
    [string]$redirectStderr,
    [string]$options
)

Write-Verbose "Entering script cURLUploader.ps1"
Write-Verbose "files = $files"
Write-Verbose "username = $username"
Write-Verbose "url = $url"
Write-Verbose "redirectStderr = $redirectStderr"
Write-Verbose "options = $options"

# Import the Task dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

$redirectStderrChecked = Convert-String $redirectStderr Boolean
Write-Verbose "redirectStderrChecked (converted) = $redirectStderrChecked"

#Verify curl is installed correctly
try
{
    $curl = Get-Command curl.exe
    $curlPath = $curl.Path
    Write-Verbose "Found curl at $curlPath"
}
catch
{
    throw 'Unable to find cURL. Verify it is installed correctly on the build agent: http://curl.haxx.se.'
}

if (!$files)
{
    throw "Files parameter not set on script"
}

if (!$url)
{
    throw "URL parameter not set on script"
}

# check for files pattern
if ($files.Contains("*") -or $files.Contains("?"))
{
    Write-Verbose "Pattern found in files parameter. Calling Find-Files."
    Write-Verbose "Find-Files -SearchPattern $files"
    $foundFiles = Find-Files -SearchPattern $files
    Write-Verbose "foundFiles = $foundFiles"

    $uploadFiles = '{"' + [System.String]::Join('","', $foundFiles) + '"}'
}
else
{
    Write-Verbose "No Pattern found in files parameter."
    $uploadFiles = $files
}
Write-Verbose "uploadFiles = $uploadFiles"
# cURL even on Windows expects forward slash as path separator. 
$updatedSlashes = $uploadFiles -replace "\\","/"
Write-Verbose "updatedSlashes = $updatedSlashes"

if ($redirectStderrChecked) 
{
    $args = "--stderr -"
}

$args = "$args $options"

if ($username -or $password)
{
    $args = "$args -u `"$username`"" + ":" + "`"$password`""
}

$args = "$args -T $updatedSlashes $url"

Write-Verbose "Running curl..."
Invoke-Tool -Path $curlPath -Arguments $args 

Write-Verbose "Leaving script cURLUploader.ps1"
