# Find-VstsMatch
[table of contents](../Commands.md#toc) | [brief](../Commands.md#find-vstsmatch)
```
NAME
    Find-VstsMatch

SYNOPSIS
    Finds files using match patterns.

SYNTAX
    Find-VstsMatch [[-DefaultRoot] <String>] [[-Pattern] <String[]>] [[-FindOptions] <Object>]
    [[-MatchOptions] <Object>] [<CommonParameters>]

DESCRIPTION
    Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
    Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
    matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
    defaultRoot is used as the find root.

PARAMETERS
    -DefaultRoot <String>
        Default path to root unrooted patterns. Falls back to System.DefaultWorkingDirectory or current
        location.

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

    -FindOptions <Object>
        When the FindOptions parameter is not specified, defaults to (New-VstsFindOptions
        -FollowSymbolicLinksTrue). Following soft links is generally appropriate unless deleting files.

        Required?                    false
        Position?                    3
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -MatchOptions <Object>
        When the MatchOptions parameter is not specified, defaults to (New-VstsMatchOptions -Dot -NoBrace
        -NoCase).

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
