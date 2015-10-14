param(
    [string]$searchPattern,
    [string]$outputdir,
    [string]$versionByBuild,
    [string]$configurationToPack,
    [string]$buildProperties,
    [string]$nuGetAdditionalArgs,
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
$b_versionByBuild = Convert-String $versionByBuild Boolean    
if ($b_versionByBuild)
{
    Write-Host "Getting version number from build"
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
    Write-Host "BUILD_BUILDNUMBER: $Env:BUILD_BUILDNUMBER"
    
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
    Write-Host "Version: $NewVersion"
}

Write-Host "Checking pattern is specified"
if(!$searchPattern)
{
    throw (Get-LocalizedString -Key "Search Pattern parameter must be set")
}

if ($outputdir -and !(Test-Path $outputdir))
{
    Write-Host "Output folder used but doesn't exists, creating it"
    New-Item $outputdir -type directory
}

# check for solution pattern
if ($searchPattern.Contains("*") -or $searchPattern.Contains("?"))
{
    Write-Host "Pattern found in solution parameter."
    Write-Host "Find-Files -SearchPattern $searchPattern"
    $foundFiles = Find-Files -SearchPattern $searchPattern 
}
else
{
    Write-Host "No Pattern found in solution parameter."
    $foundFiles = ,$searchPattern
}

$foundCount = $foundFiles.Count 
Write-Host "Found files: $foundCount"
foreach ($fileToPackage in $foundFiles)
{
    Write-Host "--File: `"$fileToPackage`""
}

foreach ($fileToPackage in $foundFiles)
{
    $slnFolder = $(Get-ItemProperty -Path $fileToPackage -Name 'DirectoryName').DirectoryName
    #Setup Nuget
    Write-Host "Creating Nuget Arguments:"
    $buildProps = "Configuration=$configurationToPack";
    if ([string]::IsNullOrEmpty($buildProperties) -eq $false)
    {
        $buildProps = ($buildProps + ";" + $buildProperties)
    }
    $argsPack = "pack `"$fileToPackage`" -OutputDirectory `"$outputdir`" -Properties $buildProps";
    
    if ($b_versionByBuild)
    {
        $argsPack = ($argsPack + " -version $NewVersion")
    }
    if($nuGetAdditionalArgs)
    {
        $argsPack = ($argsPack + " " + $nuGetAdditionalArgs);
    }    
     
    Write-Host "--ARGS: $argsPack"
    
    if(!$nuGetPath)
    {
        $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
    }
    
    if (-not $nuGetPath)
    {
        throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
    }
    
    if ($env:NUGET_EXTENSIONS_PATH)
    {
        Write-Host (Get-LocalizedString -Key "Detected NuGet extensions loader path. Environment variable NUGET_EXTENSIONS_PATH is set to: {0}" -ArgumentList $env:NUGET_EXTENSIONS_PATH)
    }

    Write-Host "Invoking nuget with $argsPack on $slnFolder"
    Invoke-Tool -Path $nugetPath -Arguments "$argsPack" -WorkingFolder $slnFolder
}