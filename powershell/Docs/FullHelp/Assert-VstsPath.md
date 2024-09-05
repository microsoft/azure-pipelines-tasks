# Assert-VstsPath
[table of contents](../Commands.md#toc) | [brief](../Commands.md#assert-vstspath)
```
NAME
    Assert-VstsPath

SYNOPSIS
    Asserts that a path exists. Throws if the path does not exist.

SYNTAX
    Assert-VstsPath [-LiteralPath] <String> [[-PathType] {Any | Container | Leaf}] [-PassThru]
    [<CommonParameters>]

PARAMETERS
    -LiteralPath <String>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -PathType

        Required?                    false
        Position?                    2
        Default value                Any
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -PassThru [<SwitchParameter>]
        True to return the path.

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
