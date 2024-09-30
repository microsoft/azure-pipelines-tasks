# Get-VstsEndpoint
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstsendpoint)
```
NAME
    Get-VstsEndpoint

SYNOPSIS
    Gets an endpoint.

SYNTAX
    Get-VstsEndpoint [-Name] <String> [-Require] [<CommonParameters>]

DESCRIPTION
    Gets an endpoint object for the specified endpoint name. The endpoint is returned as an object with three
    properties: Auth, Data, and Url.

    The Data property requires a 1.97 agent or higher.

PARAMETERS
    -Name <String>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Require [<SwitchParameter>]
        Writes an error to the error pipeline if the endpoint is not found.

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
