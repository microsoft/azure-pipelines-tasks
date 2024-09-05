# Invoke-VstsProcess
[table of contents](../Commands.md#toc) | [brief](../Commands.md#invoke-vstsprocess)
```
NAME
    Invoke-VstsProcess

SYNOPSIS
    Executes an external program as a child process.

SYNTAX
    Invoke-VstsProcess [-FileName] <String> [[-Arguments] <String>] [[-WorkingDirectory] <String>]
    [[-StdOutPath] <String>] [[-StdErrPath] <String>] [-RequireExitCodeZero] [<CommonParameters>]

DESCRIPTION
    Executes an external program and waits for the process to exit.

    After calling this command, the exit code of the process can be retrieved from the variable $LASTEXITCODE
    or from the pipe.

PARAMETERS
    -FileName <String>
        File name (path) of the program to execute.

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Arguments <String>
        Arguments to pass to the program.

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

    -StdOutPath <String>
        Path to a file to write the stdout of the process to.

        Required?                    false
        Position?                    4
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -StdErrPath <String>
        Path to a file to write the stderr of the process to.

        Required?                    false
        Position?                    5
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

OUTPUTS
    Exit code of the invoked process. Also available through the $LASTEXITCODE.

NOTES

        To change output encoding, redirect stdout to file and then read the file with the desired encoding.
```
