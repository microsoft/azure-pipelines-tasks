param(
    [string]$gulpFile,
    [string]$targets,
    [string]$arguments,
    [string]$cwd
)

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# try to find gulp in the path
$gulp = Get-Command -Name gulp -ErrorAction Ignore

if(!$gulp)
{
    Write-Verbose "try to find gulp in the node_modules in the sources directory"
    $buildSourcesDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Build.SourcesDirectory"
    $nodeBinPath = Join-Path -Path $buildSourcesDirectory -ChildPath 'node_modules\.bin'

    if(Test-Path -Path $nodeBinPath -PathType Container)
    {
        $gulpPath = Join-Path -Path $nodeBinPath -ChildPath "gulp.cmd"
        Write-Verbose "Looking for gulp.cmd in $gulpPath"
        $gulp = Get-Command -Name $gulpPath -ErrorAction Ignore
    }
    else
    {
        Write-Verbose "Recursively searching for gulp.cmd in $buildSourcesDirectory"
        $searchPattern = Join-Path -Path $buildSourcesDirectory -ChildPath '**\gulp.cmd'
        $foundFiles = Find-Files -SearchPattern $searchPattern
        foreach($file in $foundFiles)
        {
            $gulpPath = $file;
            $gulp = Get-Command -Name $gulpPath
            break;
        }
    }
}

$arguments = "--gulpfile `"" + $gulpFile + "`" " + $arguments

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

Write-Verbose "Running Gulp $gulp"
Invoke-Tool -Path $gulp.Path -Arguments $arguments -WorkingFolder $cwd