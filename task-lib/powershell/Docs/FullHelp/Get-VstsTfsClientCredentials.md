# Get-VstsTfsClientCredentials
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vststfsclientcredentials)
```
NAME
    Get-VstsTfsClientCredentials

SYNOPSIS
    Gets a credentials object that can be used with the TFS extended client SDK.

SYNTAX
    Get-VstsTfsClientCredentials [[-OMDirectory] <String>] [<CommonParameters>]

DESCRIPTION
    The agent job token is used to construct the credentials object. The identity associated with the token
    depends on the scope selected in the build/release definition (either the project collection
    build/release service identity, or the project build/release service identity).

    Refer to Get-VstsTfsService for a more simple to get a TFS service object.

    *** DO NOT USE Agent.ServerOMDirectory *** See
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when
    working with the TFS extended client SDK from a task.

PARAMETERS
    -OMDirectory <String>
        Directory where the extended client object model DLLs are located. If the DLLs for the credential
        types are not already loaded, an attempt will be made to automatically load the required DLLs from
        the object model directory.

        If not specified, defaults to the directory of the entry script for the task.

        *** DO NOT USE Agent.ServerOMDirectory *** See
        https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage
        when working with the TFS extended client SDK from a task.

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
    $credentials = Get-VstsTfsClientCredentials
    Add-Type -LiteralPath "$PSScriptRoot\Microsoft.TeamFoundation.VersionControl.Client.dll"
    $tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection(
        (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require),
        $credentials)
    $versionControlServer = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.VersionControl.Clie
    nt.VersionControlServer])
    $versionControlServer.GetItems('$/*').Items | Format-List
```
