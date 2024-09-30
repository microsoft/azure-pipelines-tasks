# Get-VstsTaskVariableInfo
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vststaskvariableinfo)
```
NAME
    Get-VstsTaskVariableInfo

SYNOPSIS
    Gets all job variables available to the task. Requires 2.104.1 agent or higher.

SYNTAX
    Get-VstsTaskVariableInfo [<CommonParameters>]

DESCRIPTION
    Gets a snapshot of the current state of all job variables available to the task.
    Requires a 2.104.1 agent or higher for full functionality.

    Returns an array of objects with the following properties:
        [string]Name
        [string]Value
        [bool]Secret

    Limitations on an agent prior to 2.104.1:
     1) The return value does not include all public variables. Only public variables
        that have been added using setVariable are returned.
     2) The name returned for each secret variable is the formatted environment variable
        name, not the actual variable name (unless it was set explicitly at runtime using
        setVariable).

PARAMETERS
    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).
```
