# Get-VstsSecureFileName
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstssecurefilename)
```
NAME
    Get-VstsSecureFileName

SYNOPSIS
    Gets a secure file name.

SYNTAX
    Get-VstsSecureFileName [-Id] <String> [-Require] [<CommonParameters>]

DESCRIPTION
    Gets the name for a secure file.

PARAMETERS
    -Id <String>
        Secure file id.

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Require [<SwitchParameter>]
        Writes an error to the error pipeline if the ticket is not found.

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
