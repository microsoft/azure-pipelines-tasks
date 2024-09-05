# Select-VstsMatch
[table of contents](../Commands.md#toc) | [brief](../Commands.md#select-vstsmatch)
```
NAME
    Select-VstsMatch

SYNOPSIS
    Applies match patterns against a list of files.

SYNTAX
    Select-VstsMatch [[-ItemPath] <String[]>] [[-Pattern] <String[]>] [[-PatternRoot] <String>] [[-Options]
    <Object>] [<CommonParameters>]

DESCRIPTION
    Applies match patterns to a list of paths. Supports interleaved exclude patterns.

PARAMETERS
    -ItemPath <String[]>
        Array of paths.

        Required?                    false
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Pattern <String[]>
        Patterns to apply. Supports interleaved exclude patterns.

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -PatternRoot <String>
        Default root to apply to unrooted patterns. Not applied to basename-only patterns when
        Options.MatchBase is true.

        Required?                    false
        Position?                    3
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Options <Object>
        When the Options parameter is not specified, defaults to (New-VstsMatchOptions -Dot -NoBrace -NoCase).

        Required?                    false
        Position?                    4
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).
```
