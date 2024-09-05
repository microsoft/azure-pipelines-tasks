# Get-VstsVssCredentials
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstsvsscredentials)
```
NAME
    Get-VstsVssCredentials

SYNOPSIS
    Gets a credentials object that can be used with the VSTS REST SDK.

SYNTAX
    Get-VstsVssCredentials [[-OMDirectory] <String>] [<CommonParameters>]

DESCRIPTION
    The agent job token is used to construct the credentials object. The identity associated with the token
    depends on the scope selected in the build/release definition (either the project collection
    build/release service identity, or the project service build/release identity).

    Refer to Get-VstsVssHttpClient for a more simple to get a VSS HTTP client.

    *** DO NOT USE Agent.ServerOMDirectory *** See
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when
    working with the VSTS REST SDK from a task.

PARAMETERS
    -OMDirectory <String>
        Directory where the REST client object model DLLs are located. If the DLLs for the credential types
        are not already loaded, an attempt will be made to automatically load the required DLLs from the
        object model directory.

        If not specified, defaults to the directory of the entry script for the task.

        *** DO NOT USE Agent.ServerOMDirectory *** See
        https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage
        when working with the VSTS REST SDK from a task.

        Required?                    false
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

    PS C:\>#

    # Refer to Get-VstsTfsService for a more simple way to get a TFS service object.
    #
    # This example works using the 14.x .NET SDK. A Newtonsoft.Json 6.0 to 8.0 binding
    # redirect may be required when working with the 15.x SDK. Or use Get-VstsVssHttpClient
    # to avoid managing the binding redirect.
    #
    $vssCredentials = Get-VstsVssCredentials
    $collectionUrl = New-Object System.Uri((Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri'
    -Require))
    Add-Type -LiteralPath "$PSScriptRoot\Microsoft.TeamFoundation.Core.WebApi.dll"
    $projectHttpClient = New-Object Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient($collectionUrl,
    $vssCredentials)
    $projectHttpClient.GetProjects().Result
```
