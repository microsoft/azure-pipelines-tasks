# Get-VstsTfsService
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vststfsservice)
```
NAME
    Get-VstsTfsService

SYNOPSIS
    Gets a TFS extended client service.

SYNTAX
    Get-VstsTfsService [-TypeName] <String> [[-OMDirectory] <String>] [[-Uri] <String>]
    [[-TfsClientCredentials] <Object>] [<CommonParameters>]

DESCRIPTION
    Gets an instance of an ITfsTeamProjectCollectionObject.

    *** DO NOT USE Agent.ServerOMDirectory *** See
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when
    working with the TFS extended client SDK from a task.

PARAMETERS
    -TypeName <String>
        Namespace-qualified type name of the service to get.

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -OMDirectory <String>
        Directory where the extended client object model DLLs are located. If the DLLs for the types are not
        already loaded, an attempt will be made to automatically load the required DLLs from the object model
        directory.

        If not specified, defaults to the directory of the entry script for the task.

        *** DO NOT USE Agent.ServerOMDirectory *** See
        https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage
        when working with the TFS extended client SDK from a task.

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Uri <String>
        URI to use when initializing the service. If not specified, defaults to
        System.TeamFoundationCollectionUri.

        Required?                    false
        Position?                    3
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -TfsClientCredentials <Object>
        Credentials to use when initializing the service. If not specified, the default uses the agent job
        token to construct the credentials object. The identity associated with the token depends on the
        scope selected in the build/release definition (either the project collection build/release service
        identity, or the project build/release service identity).

        Required?                    false
        Position?                    4
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>$versionControlServer = Get-VstsTfsService -TypeName
    Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer

    $versionControlServer.GetItems('$/*').Items | Format-List
```
