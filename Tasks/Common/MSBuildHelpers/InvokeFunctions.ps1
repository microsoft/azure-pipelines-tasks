########################################
# Private module variables.
########################################
$script:loggingCommandPrefix = '##vso['
$script:loggingCommandEscapeMappings = @( # TODO: WHAT ABOUT "="? WHAT ABOUT "%"?
    New-Object psobject -Property @{ Token = ';' ; Replacement = '%3B' }
    New-Object psobject -Property @{ Token = "`r" ; Replacement = '%0D' }
    New-Object psobject -Property @{ Token = "`n" ; Replacement = '%0A' }
)

########################################
# Public functions.
########################################
function Invoke-BuildTools {
    [CmdletBinding()]
    param(
        [switch]$NuGetRestore,
        [string[]]$SolutionFiles,
        [string]$MSBuildLocation,
        [string]$MSBuildArguments,
        [switch]$Clean,
        [switch]$NoTimelineLogger)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        foreach ($file in $SolutionFiles) {
            if ($NuGetRestore) {
                Invoke-NuGetRestore -File $file
            }

            if ($Clean) {
                Invoke-MSBuild -ProjectFile $file -Targets Clean -LogFile "$file-clean.log" -MSBuildPath $MSBuildLocation -AdditionalArguments $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger
            }

            Invoke-MSBuild -ProjectFile $file -LogFile "$file.log" -MSBuildPath $MSBuildLocation -AdditionalArguments $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Private functions.
########################################
function ConvertFrom-SerializedLoggingCommand {
    [CmdletBinding()]
    param([string]$Message)

    if (!$Message) {
        return
    }

    try {
        # Get the index of the prefix.
        $prefixIndex = $Message.IndexOf($script:loggingCommandPrefix)
        if ($prefixIndex -lt 0) {
            return
        }

        # Get the index of the separator between the command info and the data.
        $rbIndex = $Message.IndexOf(']'[0], $prefixIndex)
        if ($rbIndex -lt 0) {
            return
        }

        # Get the command info.
        $cmdIndex = $prefixIndex + $script:loggingCommandPrefix.Length
        $cmdInfo = $Message.Substring($cmdIndex, $rbIndex - $cmdIndex)
        $spaceIndex = $cmdInfo.IndexOf(' '[0])
        if ($spaceIndex -lt 0) {
            $command = $cmdInfo
        } else {
            $command = $cmdInfo.Substring(0, $spaceIndex)
        }

        # Get the area and event.
        [string[]]$areaEvent = $command.Split([char[]]@( '.'[0] ), [System.StringSplitOptions]::RemoveEmptyEntries)
        if ($areaEvent.Length -ne 2) {
            return
        }

        $areaName = $areaEvent[0]
        $eventName = $areaEvent[1]

        # Get the properties.
        $eventProperties = @{ }
        if ($spaceIndex -ge 0) {
            $propertiesStr = $cmdInfo.Substring($spaceIndex + 1)
            [string[]]$splitProperties = $propertiesStr.Split([char[]]@( ';'[0] ), [System.StringSplitOptions]::RemoveEmptyEntries)
            foreach ($propertyStr in $splitProperties) {
                [string[]]$pair = $propertyStr.Split([char[]]@( '='[0] ), 2, [System.StringSplitOptions]::RemoveEmptyEntries)
                if ($pair.Length -eq 2) {
                    $pair[1] = Format-LoggingCommandData -Value $pair[1] -Reverse
                    $eventProperties[$pair[0]] = $pair[1]
                }
            }
        }

        $eventData = Format-LoggingCommandData -Value $Message.Substring($rbIndex + 1) -Reverse
        New-Object -TypeName psobject -Property @{
            'Area' = $areaName
            'Event' = $eventName
            'Properties' = $eventProperties
            'Data' = $eventData
        }
    } catch { }
}

function Format-LoggingCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Area,
        [Parameter(Mandatory = $true)]
        [string]$Event,
        [string]$Data,
        [hashtable]$Properties)

    # Append the preamble.
    [System.Text.StringBuilder]$sb = New-Object -TypeName System.Text.StringBuilder
    $null = $sb.Append($script:loggingCommandPrefix).Append($Area).Append('.').Append($Event)

    # Append the properties.
    if ($Properties) {
        $first = $true
        foreach ($key in $Properties.Keys) {
            [string]$value = Format-LoggingCommandData $Properties[$key]
            if ($value) {
                if ($first) {
                    $null = $sb.Append(' ')
                    $first = $false
                } else {
                    $null = $sb.Append(';')
                }

                $null = $sb.Append("$key=$value")
            }
        }
    }

    # Append the tail and output the value.
    $Data = Format-LoggingCommandData $Data
    $sb.Append(']').Append($Data).ToString()
}

function Format-LoggingCommandData {
    [CmdletBinding()]
    param([string]$Value, [switch]$Reverse)

    if (!$Value) {
        return ''
    }

    if (!$Reverse) {
        foreach ($mapping in $script:loggingCommandEscapeMappings) {
            $Value = $Value.Replace($mapping.Token, $mapping.Replacement)
        }
    } else {
        for ($i = $script:loggingCommandEscapeMappings.Length - 1 ; $i -ge 0 ; $i--) {
            $mapping = $script:loggingCommandEscapeMappings[$i]
            $Value = $Value.Replace($mapping.Replacement, $mapping.Token)
        }
    }

    return $Value
}

function Invoke-MSBuild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 1)]
        [string]$ProjectFile,
        [string]$Targets,
        [string]$LogFile,
        [switch]$NoTimelineLogger,
        [string]$MSBuildPath,
        [string]$AdditionalArguments)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Get the MSBuild path.
        if (!$MSBuildPath) {
            $MSBuildPath = Get-MSBuildPath
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
        $arguments = "`"$ProjectFile`" /nologo /m /nr:false"

        # Add the targets if specified.
        if ($Targets) {
            $arguments = "$arguments /t:`"$Targets`""
        }

        # If a log file was specified then hook up the default file logger.
        if ($LogFile) {
            $arguments = "$arguments /fl /flp:`"logfile=$LogFile`""
        }

        # Always hook up the timeline logger. If project events are not requested then we will simply drop those
        # messages on the floor.
        $loggerAssembly = "$(Get-VstsTaskVariable -Name Agent.HomeDirectory -Require)\Agent\Worker\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll"
        $null = Assert-VstsPath -LiteralPath $loggerAssembly -PathType Leaf
        $arguments = "$arguments /dl:CentralLogger,`"$loggerAssembly`"*ForwardingLogger,`"$loggerAssembly`""

        if ($AdditionalArguments) {
            $arguments = "$arguments $AdditionalArguments"
        }

        # Store the solution folder so we can provide solution-relative paths (for now).
        $solutionDirectory = [System.IO.Path]::GetDirectoryName($ProjectFile)

        # Start the detail timeline.
        if (!$NoTimelineLogger) {
            $detailId = [guid]::NewGuid()
            $detailName = Get-VstsLocString -Key MSB_Build0 -ArgumentList ([System.IO.Path]::GetFileName($ProjectFile))
            $detailStartTime = [datetime]::UtcNow.ToString('O')
            Write-VstsLogDetail -Id $detailId -Type Process -Name $detailName -Progress 0 -StartTime $detailStartTime -State Initialized -AsOutput
        }

        $detailResult = 'Succeeded'
        try {
            if ($NoTimelineLogger) {
                Invoke-VstsTool -FileName $MSBuildPath -Arguments $arguments -RequireExitCodeZero
            } else {
                Invoke-VstsTool -FileName $MSBuildPath -Arguments $arguments -RequireExitCodeZero |
                    ForEach-Object {
                        if ($_ -and
                            $_.IndexOf($script:loggingCommandPrefix) -ge 0 -and
                            ($command = ConvertFrom-SerializedLoggingCommand -Message $_)) {
                            if ($command.Area -eq 'task' -and
                                $command.Event -eq 'logissue' -and
                                $command.Properties['type'] -eq 'error') {

                                # An error issue was detected. Set the result to Failed for the logdetail completed event.
                                $detailResult = 'Failed'
                            } elseif ($command.Area -eq 'task' -and
                                $command.Event -eq 'logdetail' -and
                                !$NoTimelineLogger) {

                                if (!($parentProjectId = $command.Properties['parentid']) -or
                                    [guid]$parentProjectId -eq [guid]::Empty) {

                                    # Default the parent ID to the root ID.
                                    $command.Properties['parentid'] = $detailId.ToString('D')
                                }

                                if ($projFile = $command.Properties['name']) {
                                    # Make the project file relative.
                                    if ($projFile.StartsWith("$solutionDirectory\", [System.StringComparison]::OrdinalIgnoreCase)) {
                                        $projFile = $projFile.Substring($solutionDirectory.Length).TrimStart('\'[0])
                                    } else {
                                        $projFile = [System.IO.Path]::GetFileName($projFile)
                                    }

                                    # If available, add the targets to the name.
                                    if ($targetNames = $command.Properties['targetnames']) {
                                        $projFile = "$projFile ($targetNames)"
                                    }

                                    $command.Properties['name'] = $projFile
                                }
                            }

                            Write-LoggingCommand -Command $command -AsOutput
                        } else {
                            $_
                        }
                    }
            }

            if ($LASTEXITCODE -ne 0) {
                Write-VstsSetResult -Result Failed -DoNotThrow
            }
        } finally {
            # Complete the detail timeline.
            if (!$NoTimelineLogger) {
                $detailFinishTime = [datetime]::UtcNow.ToString('O')
                Write-VstsLogDetail -Id $detailId -FinishTime $detailFinishTime -Progress 100 -State Completed -Result $detailResult -AsOutput
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

        $nugetPath = Assert-VstsPath -LiteralPath "$(Get-VstsTaskVariable -Name Agent.HomeDirectory -Require)\Agent\Worker\Tools\NuGet.exe" -PathType Leaf -PassThru
        if ($env:NUGET_EXTENSIONS_PATH) {
            Write-Host (Get-VstsLocString -Key MSB_DetectedNuGetExtensionsLoaderPath0 -ArgumentList $env:NUGET_EXTENSIONS_PATH)
        }

        $directory = [System.IO.Path]::GetDirectoryName($file)
        Invoke-VstsTool -FileName $nugetPath -Arguments "restore `"$file`" -NonInteractive" -WorkingDirectory $directory -RequireExitCodeZero
        if ($LASTEXITCODE -ne 0) {
            Write-VstsSetResult -Result Failed -DoNotThrow
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Write-LoggingCommand {
    [CmdletBinding(DefaultParameterSetName = 'Parameters')]
    param(
        [Parameter(Mandatory = $true, ParameterSetName = 'Parameters')]
        [string]$Area,
        [Parameter(Mandatory = $true, ParameterSetName = 'Parameters')]
        [string]$Event,
        [Parameter(ParameterSetName = 'Parameters')]
        [string]$Data,
        [Parameter(ParameterSetName = 'Parameters')]
        [hashtable]$Properties,
        [Parameter(Mandatory = $true, ParameterSetName = 'Object')]
        $Command,
        [switch]$AsOutput)

    if ($PSCmdlet.ParameterSetName -eq 'Object') {
        Write-LoggingCommand -Area $Command.Area -Event $Command.Event -Data $Command.Data -Properties $Command.Properties -AsOutput:$AsOutput
        return
    }

    $command = Format-LoggingCommand -Area $Area -Event $Event -Data $Data -Properties $Properties
    if ($AsOutput) {
        $command
    } else {
        Write-Host $command
    }
}
