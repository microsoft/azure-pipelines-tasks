# Get-VstsLocString
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstslocstring)
```
NAME
    Get-VstsLocString

SYNOPSIS
    Gets a localized resource string.

SYNTAX
    Get-VstsLocString [-Key] <String> [[-ArgumentList] <Object[]>] [<CommonParameters>]

DESCRIPTION
    Gets a localized resource string and optionally formats the string with arguments.

    If the format fails (due to a bad format string or incorrect expected arguments in the format string),
    then the format string is returned followed by each of the arguments (delimited by a space).

    If the lookup key is not found, then the lookup key is returned followed by each of the arguments
    (delimited by a space).

PARAMETERS
    -Key <String>

        Required?                    true
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -ArgumentList <Object[]>

        Required?                    false
        Position?                    3
        Default value                @( )
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).
```
