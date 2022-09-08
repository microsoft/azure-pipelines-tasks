########################################
# Public functions.
########################################
function Invoke-BuildTools {
    [CmdletBinding()]
    param(
        [switch]$NuGetRestore,
        [string[]]$SolutionFiles,
        [string]$MSBuildLocation, # TODO: Switch MSBuildLocation to mandatory. Both callers (MSBuild and VSBuild task) throw prior to reaching here if MSBuild cannot be resolved.
        [string]$MSBuildArguments,
        [switch]$Clean,
        [switch]$NoTimelineLogger,
        [switch]$CreateLogFile,
        [string]$LogFileVerbosity,
        [switch]$IsDefaultLoggerEnabled = $true)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        foreach ($file in $SolutionFiles) {
            if ($NuGetRestore) {
                Invoke-NuGetRestore -File $file
            }
            
            $splat = @{ }

            if ($LogFileVerbosity) {
                $splat["LogFileVerbosity"] = $LogFileVerbosity
            }

            if ($Clean) {
                if ($CreateLogFile) {
                    $splat["LogFile"] = "$file-clean.log"
                }
                Invoke-MSBuild -ProjectFile $file -Targets Clean -MSBuildPath $MSBuildLocation -AdditionalArguments $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger -IsDefaultLoggerEnabled:$IsDefaultLoggerEnabled @splat
            }

            # If we cleaned and passed /t targets, we don't need to run them again
            if (!$Clean -or $MSBuildArguments -notmatch "[/-]t(arget)?:\S+") {
                if ($CreateLogFile) {
                    $splat["LogFile"] = "$file.log"
                }
                Invoke-MSBuild -ProjectFile $file -MSBuildPath $MSBuildLocation -AdditionalArguments $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger -IsDefaultLoggerEnabled:$IsDefaultLoggerEnabled @splat
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Private functions.
########################################
function Invoke-MSBuild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 1)]
        [string]$ProjectFile,
        [string]$Targets,
        [string]$LogFile,
        [string]$LogFileVerbosity,
        [switch]$NoTimelineLogger,
        [string]$MSBuildPath, # TODO: Switch MSBuildPath to mandatory. Both callers (MSBuild and VSBuild task) throw prior to reaching here if MSBuild cannot be resolved.
        [string]$AdditionalArguments,
        [switch]$IsDefaultLoggerEnabled = $true)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Get the MSBuild path.
        if (!$MSBuildPath) {
            $MSBuildPath = Get-MSBuildPath # TODO: Delete this condition block. Both callers (MSBuild and VSBuild task) throw prior to reaching here if MSBuild cannot be resolved.
        } else {
            $MSBuildPath = [System.Environment]::ExpandEnvironmentVariables($MSBuildPath)
            if ($MSBuildPath -notlike '*msbuild.exe') {
                $MSBuildPath = [System.IO.Path]::Combine($MSBuildPath, 'msbuild.exe')
            }
        }

        # Validate the path exists.
        $null = Assert-VstsPath -LiteralPath $MSBuildPath -PathType Leaf

        # Don't show the logo and do not allow node reuse so all child nodes are shut down once the master
        # node has completed build orchestration.
        $arguments = "`"$ProjectFile`" /nologo /nr:false"

        # Add the targets if specified.
        if ($Targets) {
            $arguments = "$arguments /t:`"$Targets`""
        }

        # If a log file was specified then hook up the default file logger.
        if ($LogFile) {
            $arguments = "$arguments /fl /flp:`"logfile=$LogFile;verbosity=$LogFileVerbosity`""
        }

        # Start the detail timeline.
        $detailId = ''
        if (!$NoTimelineLogger) {
            $detailId = [guid]::NewGuid()
            $detailName = Get-VstsLocString -Key MSB_Build0 -ArgumentList ([System.IO.Path]::GetFileName($ProjectFile))
            $detailStartTime = [datetime]::UtcNow.ToString('O')
            Write-VstsLogDetail -Id $detailId -Type Process -Name $detailName -Progress 0 -StartTime $detailStartTime -State Initialized -AsOutput
        }

        # Store the solution folder so we can provide solution-relative paths (for now) for the project events.
        $solutionDirectory = [System.IO.Path]::GetDirectoryName($ProjectFile)

        if($IsDefaultLoggerEnabled) {
            # Hook up the custom logger.
            $loggerAssembly = "$PSScriptRoot\tools\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll"
            Assert-VstsPath -LiteralPath $loggerAssembly -PathType Leaf
            $arguments = "$arguments /dl:CentralLogger,`"$loggerAssembly`";`"RootDetailId=$($detailId)|SolutionDir=$($solutionDirectory)|enableOrphanedProjectsLogs=true`"*ForwardingLogger,`"$loggerAssembly`""
        }

        # Append additional arguments.
        if ($AdditionalArguments) {
            $arguments = "$arguments $AdditionalArguments"
        }

        $global:LASTEXITCODE = ''
        try {
            # Invoke MSBuild.
            Invoke-VstsTool -FileName $MSBuildPath -Arguments $arguments -RequireExitCodeZero
            if ($LASTEXITCODE -ne 0) {
                Write-VstsSetResult -Result Failed -DoNotThrow
            }
        } finally {
            # Complete the detail timeline.
            if (!$NoTimelineLogger) {
                if ($LASTEXITCODE -ne 0) {
                    $detailResult = 'Failed'
                } else {
                    $detailResult = 'Succeeded'
                }

                $detailFinishTime = [datetime]::UtcNow.ToString('O')
                Write-VstsLogDetail -Id $detailId -FinishTime $detailFinishTime -Progress 100 -State Completed -Result $detailResult -AsOutput
            }

            if ($LogFile) {
                if (Test-Path -Path $LogFile) {
                    Write-Host "##vso[task.uploadfile]$LogFile"
                } else {
                    Write-Verbose "Skipping upload of '$LogFile' since it does not exist."
                }
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Invoke-NuGetRestore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 1)]
        [string]$File)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Warning (Get-VstsLocString -Key MSB_RestoreNuGetPackagesDeprecated)
        try {
            $nuGetPath = Assert-VstsPath -LiteralPath "$(Get-VstsTaskVariable -Name Agent.HomeDirectory -Require)\externals\nuget\NuGet.exe" -PathType Leaf -PassThru
        } catch {
            # Temporary fallback logic for legacy Windows agent.
            $nuGetPath = Assert-VstsPath -LiteralPath "$(Get-VstsTaskVariable -Name Agent.HomeDirectory -Require)\Agent\Worker\Tools\NuGet.exe" -PathType Leaf -PassThru
        }

        if ($env:NUGET_EXTENSIONS_PATH) {
            Write-Host (Get-VstsLocString -Key MSB_DetectedNuGetExtensionsLoaderPath0 -ArgumentList $env:NUGET_EXTENSIONS_PATH)
        }

        $directory = [System.IO.Path]::GetDirectoryName($file)
        Invoke-VstsTool -FileName $nuGetPath -Arguments "restore `"$file`" -NonInteractive" -WorkingDirectory $directory -RequireExitCodeZero
        if ($LASTEXITCODE -ne 0) {
            Write-VstsSetResult -Result Failed -DoNotThrow
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
