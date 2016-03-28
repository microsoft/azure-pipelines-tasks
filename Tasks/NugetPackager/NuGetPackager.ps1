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
    Write-Verbose "Getting version number from build"
    ##Get Version from Build
    
    # Regular expression pattern to find the version in the build number 
    # and then apply it to the assemblies
    $VersionRegex = "\d+\.\d+\.\d+(?:\.\d+)?"
    
    # If this script is not running on a build server, remind user to 
    # set environment variables so that this script can be debugged
    if(-not ($Env:BUILD_SOURCESDIRECTORY -and $Env:BUILD_BUILDNUMBER))
    {
        Write-Error (Get-LocalizedString -Key "To test this script interactively, set these environment variables.")
        Write-Host (Get-LocalizedString -Key '{0} (example: "C:\code\FabrikamTFVC\HelloWorld")' -ArgumentList '$Env:BUILD_SOURCESDIRECTORY')
        Write-Host (Get-LocalizedString -Key '{0} (example: "Build HelloWorld_0000.00.00.0")' -ArgumentList '$Env:BUILD_BUILDNUMBER')
        exit 1
    }
    
    #Make sure there is a build number
    if (-not $Env:BUILD_BUILDNUMBER)
    {
        Write-Error (Get-LocalizedString -Key "BUILD_BUILDNUMBER environment variable is missing.")
        exit 1
    }
    Write-Verbose "BUILD_BUILDNUMBER: $Env:BUILD_BUILDNUMBER"
    
    # Get and validate the version data
    $VersionData = [regex]::matches($Env:BUILD_BUILDNUMBER,$VersionRegex)
    switch($VersionData.Count)
    {
       0        
          { 
             Write-Error (Get-LocalizedString -Key "Could not find version number data in BUILD_BUILDNUMBER.")
             exit 1
          }
       1 {}
       default 
          { 
             Write-Warning (Get-LocalizedString -Key "Found more than one instance of version data in BUILD_BUILDNUMBER.")
             Write-Warning (Get-LocalizedString -Key "Assuming first instance is version.")
          }
    }
    $NewVersion = $VersionData[0]
    Write-Verbose "Version: $NewVersion"
}

Write-Verbose "Checking pattern is specified"
if(!$searchPattern)
{
    throw (Get-LocalizedString -Key "Search pattern parameter must be set")
}

if ($outputdir -and !(Test-Path $outputdir))
{
    Write-Verbose "Output folder selected but doesn't exist. Creating it."
    New-Item $outputdir -type directory
}

# check for solution pattern
if ($searchPattern.Contains("*") -or $searchPattern.Contains("?") -or $searchPattern.Contains(";"))
{
    Write-Verbose "Pattern found in solution parameter."    
    if ($env:BUILD_SOURCESDIRECTORY)
    {
        Write-Verbose "Using build.sourcesdirectory as root folder"
        Write-Host "Find-Files -SearchPattern $searchPattern -RootFolder $env:BUILD_SOURCESDIRECTORY"
        $foundFiles = Find-Files -SearchPattern $searchPattern -RootFolder $env:BUILD_SOURCESDIRECTORY
    }
    elseif ($env:SYSTEM_ARTIFACTSDIRECTORY)
    {
        Write-Verbose "Using system.artifactsdirectory as root folder"
        Write-Host "Find-Files -SearchPattern $searchPattern -RootFolder $env:SYSTEM_ARTIFACTSDIRECTORY"
        $foundFiles = Find-Files -SearchPattern $searchPattern -RootFolder $env:SYSTEM_ARTIFACTSDIRECTORY
    }
    else
    {
        Write-Host "Find-Files -SearchPattern $searchPattern"
        $foundFiles = Find-Files -SearchPattern $searchPattern
    }
}
else
{
    Write-Verbose "No pattern found in solution parameter."
    $foundFiles = ,$searchPattern
}

$foundCount = $foundFiles.Count
Write-Verbose "Found files: $foundCount"
foreach ($fileToPackage in $foundFiles)
{
    Write-Verbose "--File: `"$fileToPackage`""
}

$useBuiltinNuGetExe = !$nuGetPath

if($useBuiltinNuGetExe)
{
    $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
}

if (-not $nuGetPath)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
}

$initialNuGetExtensionsPath = $env:NUGET_EXTENSIONS_PATH
try
{
    if ($env:NUGET_EXTENSIONS_PATH)
    {
        if($useBuiltinNuGetExe)
        {
            # NuGet.exe extensions only work with a single specific version of nuget.exe. This causes problems
            # whenever we update nuget.exe on the agent.
            $env:NUGET_EXTENSIONS_PATH = $null
            Write-Warning (Get-LocalizedString -Key "The NUGET_EXTENSIONS_PATH environment variable is set, but nuget.exe extensions are not supported when using the built-in NuGet implementation.")   
        }
        else
        {
            Write-Host (Get-LocalizedString -Key "Detected NuGet extensions loader path. Environment variable NUGET_EXTENSIONS_PATH is set to: {0}" -ArgumentList $env:NUGET_EXTENSIONS_PATH)
        }
    }

    foreach ($fileToPackage in $foundFiles)
    {
        $slnFolder = $(Get-ItemProperty -Path $fileToPackage -Name 'DirectoryName').DirectoryName
        #Setup Nuget

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
         
        Write-Verbose "NuGet arguments: $argsPack"

        Write-Verbose "Invoking nuget with $argsPack on $slnFolder"
        Invoke-Tool -Path $nugetPath -Arguments "$argsPack" -WorkingFolder $slnFolder
    }
}
finally
{
    $env:NUGET_EXTENSIONS_PATH = $initialNuGetExtensionsPath
}

