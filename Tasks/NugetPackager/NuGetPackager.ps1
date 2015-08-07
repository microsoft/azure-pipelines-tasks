param(
    [string]$nuspecFile,
    [string]$nugetServer,
    [string]$nugetServerKey,
    [string]$nuGetPath
)

Write-Verbose "Entering script $MyInvocation.MyCommand.Name"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

Write-Verbose "Importing modules"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    
Write-Verbose "Getting version number from build"
##Get Version from Build

# Regular expression pattern to find the version in the build number 
# and then apply it to the assemblies
$VersionRegex = "\d+\.\d+\.\d+\.\d+"

# If this script is not running on a build server, remind user to 
# set environment variables so that this script can be debugged
if(-not ($Env:BUILD_SOURCESDIRECTORY -and $Env:BUILD_BUILDNUMBER))
{
    Write-Error "You must set the following environment variables"
    Write-Error "to test this script interactively."
    Write-Host '$Env:BUILD_SOURCESDIRECTORY - For example, enter something like:'
    Write-Host '$Env:BUILD_SOURCESDIRECTORY = "C:\code\FabrikamTFVC\HelloWorld"'
    Write-Host '$Env:BUILD_BUILDNUMBER - For example, enter something like:'
    Write-Host '$Env:BUILD_BUILDNUMBER = "Build HelloWorld_0000.00.00.0"'
    exit 1
}

#Make sure there is a build number
if (-not $Env:BUILD_BUILDNUMBER)
{
    Write-Error ("BUILD_BUILDNUMBER environment variable is missing.")
    exit 1
}
Write-Verbose "BUILD_BUILDNUMBER: $Env:BUILD_BUILDNUMBER"

# Get and validate the version data
$VersionData = [regex]::matches($Env:BUILD_BUILDNUMBER,$VersionRegex)
switch($VersionData.Count)
{
   0        
      { 
         Write-Error "Could not find version number data in BUILD_BUILDNUMBER."
         exit 1
      }
   1 {}
   default 
      { 
         Write-Warning "Found more than instance of version data in BUILD_BUILDNUMBER." 
         Write-Warning "Will assume first instance is version."
      }
}
$NewVersion = $VersionData[0]
Write-Verbose "Version: $NewVersion"

Write-Verbose "Checking Nuspec file exists"
if(!$nuspecFile)
{
    throw (Get-LocalizedString -Key "Solution parameter must be set")
}

Write-Verbose "Checking server url set"
if (!$nugetServer)
{
    throw "Server must be set"
}

Write-Verbose "Checking server key set"
if (!$nugetServerKey)
{
    throw "Server Key must be set"
}

#Setup Nuget
Write-Verbose "Creating Nuget Arguments"
$argsPack = "pack $nuspecFile -version $NewVersion ";
$argsUpload = "push *.nupkg -s $nugetServer $nugetServerKey"


if(!$nuGetPath)
{
    $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
}

if (-not $nuGetPath)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
}

if($nuGetPath)
{
    $slnFolder = $(Get-ItemProperty -Path $nuspecFile -Name 'DirectoryName').DirectoryName      
    Write-Verbose "Invoking nuget with $argsPack on $slnFolder"
    Invoke-Tool -Path $nugetPath -Arguments "$argsPack" -WorkingFolder $slnFolder
    Write-Verbose "Invoking nuget with $argsUpload on $slnFolder"    
    Invoke-Tool -Path $nugetPath -Arguments "$argsUpload" -WorkingFolder $slnFolder
}