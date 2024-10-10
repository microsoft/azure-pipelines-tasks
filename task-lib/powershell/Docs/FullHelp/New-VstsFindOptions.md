# New-VstsFindOptions
[table of contents](../Commands.md#toc) | [brief](../Commands.md#new-vstsfindoptions)
```
NAME
    New-VstsFindOptions

SYNOPSIS
    Creates FindOptions for use with Find-VstsMatch.

SYNTAX
    New-VstsFindOptions [-FollowSpecifiedSymbolicLink] [-FollowSymbolicLinks] [<CommonParameters>]

DESCRIPTION
    Creates FindOptions for use with Find-VstsMatch. Contains switches to control whether to follow symlinks.

PARAMETERS
    -FollowSpecifiedSymbolicLink [<SwitchParameter>]
        Indicates whether to traverse descendants if the specified path is a symbolic link directory. Does
        not cause nested symbolic link directories to be traversed.

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -FollowSymbolicLinks [<SwitchParameter>]
        Indicates whether to traverse descendants of symbolic link directories.

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
