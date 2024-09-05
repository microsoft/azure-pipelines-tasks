# Find-VstsFiles
[table of contents](../Commands.md#toc) | [brief](../Commands.md#find-vstsfiles)
```
NAME
    Find-VstsFiles

SYNOPSIS
    Finds files or directories.

SYNTAX
    Find-VstsFiles [[-LiteralDirectory] <String>] [-LegacyPattern] <String> [-IncludeFiles]
    [-IncludeDirectories] [-Force] [<CommonParameters>]

DESCRIPTION
    Finds files or directories using advanced pattern matching.

PARAMETERS
    -LiteralDirectory <String>
        Directory to search.

        Required?                    false
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -LegacyPattern <String>
        Proprietary pattern format. The LiteralDirectory parameter is used to root any unrooted patterns.

        Separate multiple patterns using ";". Escape actual ";" in the path by using ";;".
        "?" indicates a wildcard that represents any single character within a path segment.
        "*" indicates a wildcard that represents zero or more characters within a path segment.
        "**" as the entire path segment indicates a recursive search.
        "**" within a path segment indicates a recursive intersegment wildcard.
        "+:" (can be omitted) indicates an include pattern.
        "-:" indicates an exclude pattern.

        The result is from the command is a union of all the matches from the include patterns, minus the
        matches from the exclude patterns.

        Required?                    true
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -IncludeFiles [<SwitchParameter>]
        Indicates whether to include files in the results.

        If neither IncludeFiles or IncludeDirectories is set, then IncludeFiles is assumed.

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -IncludeDirectories [<SwitchParameter>]
        Indicates whether to include directories in the results.

        If neither IncludeFiles or IncludeDirectories is set, then IncludeFiles is assumed.

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Force [<SwitchParameter>]
        Indicates whether to include hidden items.

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

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>Find-VstsFiles -LegacyPattern "C:\Directory\Is?Match.txt"

    Given:
    C:\Directory\Is1Match.txt
    C:\Directory\Is2Match.txt
    C:\Directory\IsNotMatch.txt

    Returns:
    C:\Directory\Is1Match.txt
    C:\Directory\Is2Match.txt

    -------------------------- EXAMPLE 2 --------------------------

    PS C:\>Find-VstsFiles -LegacyPattern "C:\Directory\Is*Match.txt"

    Given:
    C:\Directory\IsOneMatch.txt
    C:\Directory\IsTwoMatch.txt
    C:\Directory\NonMatch.txt

    Returns:
    C:\Directory\IsOneMatch.txt
    C:\Directory\IsTwoMatch.txt

    -------------------------- EXAMPLE 3 --------------------------

    PS C:\>Find-VstsFiles -LegacyPattern "C:\Directory\**\Match.txt"

    Given:
    C:\Directory\Match.txt
    C:\Directory\NotAMatch.txt
    C:\Directory\SubDir\Match.txt
    C:\Directory\SubDir\SubSubDir\Match.txt

    Returns:
    C:\Directory\Match.txt
    C:\Directory\SubDir\Match.txt
    C:\Directory\SubDir\SubSubDir\Match.txt

    -------------------------- EXAMPLE 4 --------------------------

    PS C:\>Find-VstsFiles -LegacyPattern "C:\Directory\**"

    Given:
    C:\Directory\One.txt
    C:\Directory\SubDir\Two.txt
    C:\Directory\SubDir\SubSubDir\Three.txt

    Returns:
    C:\Directory\One.txt
    C:\Directory\SubDir\Two.txt
    C:\Directory\SubDir\SubSubDir\Three.txt

    -------------------------- EXAMPLE 5 --------------------------

    PS C:\>Find-VstsFiles -LegacyPattern "C:\Directory\Sub**Match.txt"

    Given:
    C:\Directory\IsNotAMatch.txt
    C:\Directory\SubDir\IsAMatch.txt
    C:\Directory\SubDir\IsNot.txt
    C:\Directory\SubDir\SubSubDir\IsAMatch.txt
    C:\Directory\SubDir\SubSubDir\IsNot.txt

    Returns:
    C:\Directory\SubDir\IsAMatch.txt
    C:\Directory\SubDir\SubSubDir\IsAMatch.txt
```
