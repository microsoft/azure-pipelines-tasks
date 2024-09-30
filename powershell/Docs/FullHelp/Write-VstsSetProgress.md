# Write-VstsSetProgress
[table of contents](../Commands.md#toc) | [brief](../Commands.md#write-vstssetprogress)
```
NAME
    Write-VstsSetProgress

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetProgress [-Percent] <Int32> [[-CurrentOperation] <String>] [-AsOutput] [<CommonParameters>]

PARAMETERS
    -Percent <Int32>

        Required?                    true
        Position?                    1
        Default value                0
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -CurrentOperation <String>

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -AsOutput [<SwitchParameter>]
        Indicates whether to write the logging command directly to the host or to the output pipeline.

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).
```
