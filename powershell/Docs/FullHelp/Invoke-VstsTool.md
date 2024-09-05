# Invoke-VstsTool
[table of contents](../Commands.md#toc) | [brief](../Commands.md#invoke-vststool)
```
NAME
    Invoke-VstsTool

SYNOPSIS
    Executes an external program.

SYNTAX
    Invoke-VstsTool [-FileName] <String> [[-Arguments] <String>] [[-WorkingDirectory] <String>] [[-Encoding]
    <Encoding>] [-RequireExitCodeZero] [<CommonParameters>]

DESCRIPTION
    Executes an external program and waits for the process to exit.

    After calling this command, the exit code of the process can be retrieved from the variable $LASTEXITCODE.

PARAMETERS
    -FileName <String>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Arguments <String>

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -WorkingDirectory <String>

        Required?                    false
        Position?                    3
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Encoding <Encoding>
        This parameter not required for most scenarios. Indicates how to interpret the encoding from the
        external program. An example use case would be if an external program outputs UTF-16 XML and the
        output needs to be parsed.

        Required?                    false
        Position?                    4
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -RequireExitCodeZero [<SwitchParameter>]
        Indicates whether to write an error to the error pipeline if the exit code is not zero.

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
