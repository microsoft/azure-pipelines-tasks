function Format-ArgumentsParameter {
    [cmdletbinding()]
    param(
        [string]$GulpFile,
        [string]$Targets,
        [string]$Arguments
    )

    $arguments = "--gulpfile `"$gulpFile`" $arguments"
    if($targets) {
        $arguments = "$targets $arguments"
    }

    $arguments
}

function Get-GulpCommand {
    [cmdletbinding()]
    param()

    # Try to find gulp in the path.
    $gulp = Get-Command -Name gulp -ErrorAction SilentlyContinue
    if ($gulp) {
        return $gulp
    }

    # Try to find gulp in the node modules bin directory.
    Write-Verbose "try to find gulp in the node_modules in the sources directory"
    $buildSourcesDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Build.SourcesDirectory"
    $nodeBinGulpPath = Join-Path -Path $buildSourcesDirectory -ChildPath 'node_modules\.bin\gulp.cmd'
    Write-Verbose "Looking for gulp.cmd at: $nodeBinGulpPath"
    if (Test-Path -LiteralPath $nodeBinGulpPath -PathType Leaf) {
        return (Get-Command -Name $nodeBinGulpPath)
    }

    # Try to find gulp in the build sources directory.
    Write-Verbose "Recursively searching for gulp.cmd in $buildSourcesDirectory"
    $searchPattern = Join-Path -Path $buildSourcesDirectory -ChildPath '**\gulp.cmd'
    $foundFiles = Find-Files -SearchPattern $searchPattern
    if ($foundFiles) {
        foreach ($file in $foundFiles) {
            return (Get-Command -Name $file)
        }
    }

    # Throw if can't find gulp anywhere.
    try {
        Get-Command -Name gulp -ErrorAction Stop
    } catch {
        throw $_.Exception
    }
}

function Get-WorkingDirectoryParameter {
    [cmdletbinding()]
    param(
        [string]$Cwd
    )

    if($cwd) {
        Write-Verbose "Setting working directory to $cwd"
        Set-Location $cwd
    } else {
        $location = Get-Location
        $cwd = $location.Path
    }

    $cwd
}