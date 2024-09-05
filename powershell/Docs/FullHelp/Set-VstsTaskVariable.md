# Set-VstsTaskVariable
[table of contents](../Commands.md#toc) | [brief](../Commands.md#set-vststaskvariable)
```
NAME
    Set-VstsTaskVariable

SYNOPSIS
    Sets a task variable.

SYNTAX
    Set-VstsTaskVariable [-Name] <String> [[-Value] <String>] [-Secret] [<CommonParameters>]

DESCRIPTION
    Sets a task variable in the current task context as well as in the current job context. This allows the
    task variable to retrieved by subsequent tasks within the same job.

PARAMETERS
    -Name <String>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Value <String>

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Secret [<SwitchParameter>]

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
