param(
    [string]$gruntFile,
    [string]$targets,
    [string]$arguments,
    [string]$cwd
)

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# try to find grunt in the path
$grunt = Get-Command -Name grunt -ErrorAction Ignore

if(!$grunt)
{
    Write-Verbose "try to find grunt in the node_modules in the sources directory"
    $buildSourcesDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Build.SourcesDirectory"
    $nodeBinPath = Join-Path -Path $buildSourcesDirectory -ChildPath 'node_modules\.bin'

    if(Test-Path -Path $nodeBinPath -PathType Container)
    {
        $gruntPath = Join-Path -Path $nodeBinPath -ChildPath "grunt.cmd"
        Write-Verbose "Looking for grunt.cmd in $gruntPath"
        $grunt = Get-Command -Name $gruntPath -ErrorAction Ignore
    }
    else
    {
        Write-Verbose "Recursively searching for grunt.cmd in $buildSourcesDirectory"
        $searchPattern = Join-Path -Path $buildSourcesDirectory -ChildPath '**\grunt.cmd'
        $foundFiles = Find-Files -SearchPattern $searchPattern
        foreach($file in $foundFiles)
        {
            $gruntPath = $file;
            $grunt = Get-Command -Name $gruntPath
            break;
        }
    }
}

$arguments = "--gruntfile `"" + $gruntFile + "`" " + $arguments

if($targets)
{
    $arguments = $targets + " " + $arguments  
}

if($cwd)
{
    Write-Verbose "Setting working directory to $cwd"
    Set-Location $cwd
}
else
{
    $location = Get-Location
    $cwd = $location.Path
}

Write-Verbose "Running Grunt $grunt"
Invoke-Tool -Path $grunt.Path -Arguments $arguments -WorkingFolder $cwd