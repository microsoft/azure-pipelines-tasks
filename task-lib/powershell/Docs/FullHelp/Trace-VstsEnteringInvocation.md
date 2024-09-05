# Trace-VstsEnteringInvocation
[table of contents](../Commands.md#toc) | [brief](../Commands.md#trace-vstsenteringinvocation)
```
NAME
    Trace-VstsEnteringInvocation

SYNOPSIS
    Writes verbose information about the invocation being entered.

SYNTAX
    Trace-VstsEnteringInvocation [-InvocationInfo] <InvocationInfo> [[-Parameter] <String[]>]
    [<CommonParameters>]

DESCRIPTION
    Used to trace verbose information when entering a function/script. Writes an entering message followed by
    a short description of the invocation. Additionally each bound parameter and unbound argument is also
    traced.

PARAMETERS
    -InvocationInfo <InvocationInfo>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Parameter <String[]>
        Wildcard pattern to control which bound parameters are traced.

        Required?                    false
        Position?                    2
        Default value                *
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).
```
