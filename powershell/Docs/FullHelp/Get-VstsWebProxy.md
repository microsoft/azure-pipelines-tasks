# Get-VstsWebProxy
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstswebproxy)
```
NAME
    Get-VstsWebProxy

SYNOPSIS
    Gets a VstsTaskSdk.VstsWebProxy

SYNTAX
    Get-VstsWebProxy [<CommonParameters>]

DESCRIPTION
    Gets an instance of a VstsTaskSdk.VstsWebProxy that has same proxy configuration as Build/Release agent.

    VstsTaskSdk.VstsWebProxy implement System.Net.IWebProxy interface.

PARAMETERS
    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>$webProxy = Get-VstsWebProxy

    $webProxy.GetProxy(New-Object System.Uri("https://github.com/Microsoft/azure-pipelines-task-lib"))
```
