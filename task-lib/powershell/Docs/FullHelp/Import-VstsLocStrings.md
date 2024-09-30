# Import-VstsLocStrings
[table of contents](../Commands.md#toc) | [brief](../Commands.md#import-vstslocstrings)
```
NAME
    Import-VstsLocStrings

SYNOPSIS
    Imports resource strings for use with Get-VstsLocString.

SYNTAX
    Import-VstsLocStrings [-LiteralPath] <String> [<CommonParameters>]

DESCRIPTION
    Imports resource strings for use with Get-VstsLocString. The imported strings are stored in an internal
    resource string dictionary. Optionally, if a separate resource file for the current culture exists, then
    the localized strings from that file then imported (overlaid) into the same internal resource string
    dictionary.

    Resource strings from the SDK are prefixed with "PSLIB_". This prefix should be avoided for custom
    resource strings.

PARAMETERS
    -LiteralPath <String>
        JSON file containing resource strings.

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>Import-VstsLocStrings -LiteralPath $PSScriptRoot\Task.json

    Imports strings from messages section in the JSON file. If a messages section is not defined, then no
    strings are imported. Example messages section:
    {
        "messages": {
            "Hello": "Hello you!",
            "Hello0": "Hello {0}!"
        }
    }

    -------------------------- EXAMPLE 2 --------------------------

    PS C:\>Import-VstsLocStrings -LiteralPath $PSScriptRoot\Task.json

    Overlays strings from an optional separate resource file for the current culture.

    Given the task variable System.Culture is set to 'de-DE'. This variable is set by the agent based on the
    current culture for the job.
    Given the file Task.json contains:
    {
        "messages": {
            "GoodDay": "Good day!",
        }
    }
    Given the file resources.resjson\de-DE\resources.resjson:
    {
        "loc.messages.GoodDay": "Guten Tag!"
    }

    The net result from the import command would be one new key-value pair added to the internal dictionary:
    Key = 'GoodDay', Value = 'Guten Tag!'
```
