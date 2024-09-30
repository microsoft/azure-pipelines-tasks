# Trace-VstsPath
[table of contents](../Commands.md#toc) | [brief](../Commands.md#trace-vstspath)
```
NAME
    Trace-VstsPath

SYNOPSIS
    Writes verbose information about paths.

SYNTAX
    Trace-VstsPath [[-Path] <String[]>] [-PassThru] [<CommonParameters>]

DESCRIPTION
    Writes verbose information about the paths. The paths are sorted and a the common root is written only
    once, followed by each relative path.

PARAMETERS
    -Path <String[]>

        Required?                    false
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -PassThru [<SwitchParameter>]
        Indicates whether to return the sorted paths.

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
