$script:loggingCommandPrefix = '##vso['
$script:loggingCommandEscapeMappings = @( # TODO: WHAT ABOUT "="? WHAT ABOUT "%"?
    New-Object psobject -Property @{ Token = ';' ; Replacement = '%3B' }
    New-Object psobject -Property @{ Token = "`r" ; Replacement = '%0D' }
    New-Object psobject -Property @{ Token = "`n" ; Replacement = '%0A' }
)
# TODO: BUG: Escape ]
# TODO: BUG: Escape % ???
# TODO: Add test to verify don't need to escape "=".

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-AddAttachment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Type,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'task' -Event 'addattachment' -Data $Path -Properties @{
            'type' = $Type
            'name' = $Name
        } -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-AddBuildTag {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'build' -Event 'addbuildtag' -Data $Value -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-AssociateArtifact {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Type,
        [hashtable]$Properties,
        [switch]$AsOutput)

    $p = @{ }
    if ($Properties) {
        foreach ($key in $Properties.Keys) {
            $p[$key] = $Properties[$key]
        }
    }

    $p['artifactname'] = $Name
    $p['artifacttype'] = $Type
    Write-LoggingCommand -Area 'artifact' -Event 'associate' -Data $Path -Properties $p -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-LogDetail {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [guid]$Id,
        $ParentId,
        [string]$Type,
        [string]$Name,
        $Order,
        $StartTime,
        $FinishTime,
        $Progress,
        [ValidateSet('Unknown', 'Initialized', 'InProgress', 'Completed')]
        [Parameter()]
        $State,
        [ValidateSet('Succeeded', 'SucceededWithIssues', 'Failed', 'Cancelled', 'Skipped')]
        [Parameter()]
        $Result,
        [string]$Message,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'task' -Event 'logdetail' -Data $Message -Properties @{
            'id' = $Id
            'parentid' = $ParentId
            'type' = $Type
            'name' = $Name
            'order' = $Order
            'starttime' = $StartTime
            'finishtime' = $FinishTime
            'progress' = $Progress
            'state' = $State
            'result' = $Result
        } -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-SetProgress {
    [CmdletBinding()]
    param(
        [ValidateRange(0, 100)]
        [Parameter(Mandatory = $true)]
        [int]$Percent,
        [string]$CurrentOperation,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'task' -Event 'setprogress' -Data $CurrentOperation -Properties @{
            'value' = $Percent
        } -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-SetResult {
    [CmdletBinding(DefaultParameterSetName = 'AsOutput')]
    param(
        [ValidateSet("Succeeded", "SucceededWithIssues", "Failed", "Cancelled", "Skipped")]
        [Parameter(Mandatory = $true)]
        [string]$Result,
        [string]$Message,
        [Parameter(ParameterSetName = 'AsOutput')]
        [switch]$AsOutput,
        [Parameter(ParameterSetName = 'DoNotThrow')]
        [switch]$DoNotThrow)

    Write-LoggingCommand -Area 'task' -Event 'complete' -Data $Message -Properties @{
            'result' = $Result
        } -AsOutput:$AsOutput
    if ($Result -eq 'Failed' -and !$AsOutput -and !$DoNotThrow) {
        # Special internal exception type to control the flow. Not currently intended
        # for public usage and subject to change.
        throw (New-Object VstsTaskSdk.TerminationException($Message))
    }
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-SetSecret {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'task' -Event 'setsecret' -Data $Value -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-SetVariable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Value,
        [switch]$Secret,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'task' -Event 'setvariable' -Data $Value -Properties @{
            'variable' = $Name
            'issecret' = $Secret
        } -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-TaskDebug {
    [CmdletBinding()]
    param(
        [string]$Message,
        [switch]$AsOutput)

    Write-TaskDebug_Internal @PSBoundParameters
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-TaskError {
    [CmdletBinding()]
    param(
        [string]$Message,
        [string]$ErrCode,
        [string]$SourcePath,
        [string]$LineNumber,
        [string]$ColumnNumber,
        [switch]$AsOutput)

    Write-LogIssue -Type error @PSBoundParameters
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-TaskVerbose {
    [CmdletBinding()]
    param(
        [string]$Message,
        [switch]$AsOutput)

    Write-TaskDebug_Internal @PSBoundParameters -AsVerbose
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-TaskWarning {
    [CmdletBinding()]
    param(
        [string]$Message,
        [string]$ErrCode,
        [string]$SourcePath,
        [string]$LineNumber,
        [string]$ColumnNumber,
        [switch]$AsOutput)

    Write-LogIssue -Type warning @PSBoundParameters
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-UpdateBuildNumber {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'build' -Event 'updatebuildnumber' -Data $Value -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-UploadArtifact {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerFolder,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'artifact' -Event 'upload' -Data $Path -Properties @{
            'containerfolder' = $ContainerFolder
            'artifactname' = $Name
        } -AsOutput:$AsOutput
}

<#
.SYNOPSIS
See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

.PARAMETER AsOutput
Indicates whether to write the logging command directly to the host or to the output pipeline.
#>
function Write-UploadBuildLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [switch]$AsOutput)

    Write-LoggingCommand -Area 'build' -Event 'uploadlog' -Data $Path -AsOutput:$AsOutput
}

########################################
# Private functions.
########################################
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

function Write-LogIssue {
    [CmdletBinding()]
    param(
        [ValidateSet('warning', 'error')]
        [Parameter(Mandatory = $true)]
        [string]$Type,
        [string]$Message,
        [string]$ErrCode,
        [string]$SourcePath,
        [string]$LineNumber,
        [string]$ColumnNumber,
        [switch]$AsOutput)

    $command = Format-LoggingCommand -Area 'task' -Event 'logissue' -Data $Message -Properties @{
            'type' = $Type
            'code' = $ErrCode
            'sourcepath' = $SourcePath
            'linenumber' = $LineNumber
            'columnnumber' = $ColumnNumber
        }
    if ($AsOutput) {
        return $command
    }

    if ($Type -eq 'error') {
        $foregroundColor = $host.PrivateData.ErrorForegroundColor
        $backgroundColor = $host.PrivateData.ErrorBackgroundColor
        if ($foregroundColor -isnot [System.ConsoleColor] -or $backgroundColor -isnot [System.ConsoleColor]) {
            $foregroundColor = [System.ConsoleColor]::Red
            $backgroundColor = [System.ConsoleColor]::Black
        }
    } else {
        $foregroundColor = $host.PrivateData.WarningForegroundColor
        $backgroundColor = $host.PrivateData.WarningBackgroundColor
        if ($foregroundColor -isnot [System.ConsoleColor] -or $backgroundColor -isnot [System.ConsoleColor]) {
            $foregroundColor = [System.ConsoleColor]::Yellow
            $backgroundColor = [System.ConsoleColor]::Black
        }
    }

    Write-Host $command -ForegroundColor $foregroundColor -BackgroundColor $backgroundColor
}

function Write-TaskDebug_Internal {
    [CmdletBinding()]
    param(
        [string]$Message,
        [switch]$AsVerbose,
        [switch]$AsOutput)

    $command = Format-LoggingCommand -Area 'task' -Event 'debug' -Data $Message
    if ($AsOutput) {
        return $command
    }

    if ($AsVerbose) {
        $foregroundColor = $host.PrivateData.VerboseForegroundColor
        $backgroundColor = $host.PrivateData.VerboseBackgroundColor
        if ($foregroundColor -isnot [System.ConsoleColor] -or $backgroundColor -isnot [System.ConsoleColor]) {
            $foregroundColor = [System.ConsoleColor]::Cyan
            $backgroundColor = [System.ConsoleColor]::Black
        }
    } else {
        $foregroundColor = $host.PrivateData.DebugForegroundColor
        $backgroundColor = $host.PrivateData.DebugBackgroundColor
        if ($foregroundColor -isnot [System.ConsoleColor] -or $backgroundColor -isnot [System.ConsoleColor]) {
            $foregroundColor = [System.ConsoleColor]::DarkGray
            $backgroundColor = [System.ConsoleColor]::Black
        }
    }

    Write-Host -Object $command -ForegroundColor $foregroundColor -BackgroundColor $backgroundColor
}
