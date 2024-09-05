# Get-VstsTaskVariable
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vststaskvariable)
```
NAME
    Get-VstsTaskVariable

SYNOPSIS
    Gets a task variable.

SYNTAX
    Get-VstsTaskVariable -Name <String> [-Require] [-AsBool] [-AsInt] [<CommonParameters>]

    Get-VstsTaskVariable -Name <String> [-Default <Object>] [-AsBool] [-AsInt] [<CommonParameters>]

DESCRIPTION
    Gets the value for the specified task variable.

PARAMETERS
    -Name <String>

        Required?                    true
        Position?                    named
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Default <Object>
        Default value to use if the input is null or empty.

        Required?                    false
        Position?                    named
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Require [<SwitchParameter>]
        Writes an error to the error pipeline if the input is null or empty.

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -AsBool [<SwitchParameter>]
        Returns the value as a bool. Returns true if the value converted to a string is "1" or "true" (case
        insensitive); otherwise false.

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -AsInt [<SwitchParameter>]
        Returns the value as an int. Returns the value converted to an int. Returns 0 if the conversion fails.

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
