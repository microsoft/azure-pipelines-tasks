# Write-VstsSetResult
[table of contents](../Commands.md#toc) | [brief](../Commands.md#write-vstssetresult)
```
NAME
    Write-VstsSetResult

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetResult -Result <String> [-Message <String>] [-AsOutput] [<CommonParameters>]

    Write-VstsSetResult -Result <String> [-Message <String>] [-DoNotThrow] [<CommonParameters>]

PARAMETERS
    -Result <String>

        Required?                    true
        Position?                    named
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Message <String>

        Required?                    false
        Position?                    named
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

    -DoNotThrow [<SwitchParameter>]

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
