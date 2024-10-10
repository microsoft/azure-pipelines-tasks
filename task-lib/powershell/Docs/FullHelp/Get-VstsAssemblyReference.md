# Get-VstsAssemblyReference
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstsassemblyreference)
```
NAME
    Get-VstsAssemblyReference

SYNOPSIS
    Gets assembly reference information.

SYNTAX
    Get-VstsAssemblyReference [-LiteralPath] <String> [<CommonParameters>]

DESCRIPTION
    Not supported for use during task execution. This function is only intended to help developers resolve
    the minimal set of DLLs that need to be bundled when consuming the VSTS REST SDK or TFS Extended Client
    SDK. The interface and output may change between patch releases of the VSTS Task SDK.

    Only a subset of the referenced assemblies may actually be required, depending on the functionality used
    by your task. It is best to bundle only the DLLs required for your scenario.

    Walks an assembly's references to determine all of it's dependencies. Also walks the references of the
    dependencies, and so on until all nested dependencies have been traversed. Dependencies are searched for
    in the directory of the specified assembly. NET Framework assemblies are omitted.

    See https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage
    when working with the TFS extended client SDK from a task.

PARAMETERS
    -LiteralPath <String>
        Assembly to walk.

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

    PS C:\>Get-VstsAssemblyReference -LiteralPath C:\nuget\microsoft.teamfoundationserver.client.14.102.0\lib\
    net45\Microsoft.TeamFoundation.Build2.WebApi.dll
```
