# Write-VstsLogDetail
[table of contents](../Commands.md#toc) | [brief](../Commands.md#write-vstslogdetail)
```
NAME
    Write-VstsLogDetail

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsLogDetail [-Id] <Guid> [[-ParentId] <Object>] [[-Type] <String>] [[-Name] <String>] [[-Order]
    <Object>] [[-StartTime] <Object>] [[-FinishTime] <Object>] [[-Progress] <Object>] [[-State] <Object>]
    [[-Result] <Object>] [[-Message] <String>] [-AsOutput] [<CommonParameters>]

PARAMETERS
    -Id <Guid>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -ParentId <Object>

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Type <String>

        Required?                    false
        Position?                    3
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Name <String>

        Required?                    false
        Position?                    4
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Order <Object>

        Required?                    false
        Position?                    5
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -StartTime <Object>

        Required?                    false
        Position?                    6
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -FinishTime <Object>

        Required?                    false
        Position?                    7
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Progress <Object>

        Required?                    false
        Position?                    8
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -State <Object>

        Required?                    false
        Position?                    9
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Result <Object>

        Required?                    false
        Position?                    10
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Message <String>

        Required?                    false
        Position?                    11
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -AsOutput [<SwitchParameter>]
        Indicates whether to write the logging command directly to the host or to the output pipeline.

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
