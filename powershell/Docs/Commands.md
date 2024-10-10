# Commands (v0.16.0)
## <a name="toc" />Table of Contents
* [Find](#find)
  * [Find-VstsMatch](#find-vstsmatch)
  * [New-VstsFindOptions](#new-vstsfindoptions)
  * [New-VstsMatchOptions](#new-vstsmatchoptions)
  * [Select-VstsMatch](#select-vstsmatch)
* [Input](#input)
  * [Get-VstsEndpoint](#get-vstsendpoint)
  * [Get-VstsInput](#get-vstsinput)
  * [Get-VstsSecureFileName](#get-vstssecurefilename)
  * [Get-VstsSecureFileTicket](#get-vstssecurefileticket)
  * [Get-VstsTaskVariable](#get-vststaskvariable)
  * [Get-VstsTaskVariableInfo](#get-vststaskvariableinfo)
  * [Set-VstsTaskVariable](#set-vststaskvariable)
* [Legacy Find](#legacyfind)
  * [Find-VstsFiles](#find-vstsfiles)
* [Localization](#localization)
  * [Get-VstsLocString](#get-vstslocstring)
  * [Import-VstsLocStrings](#import-vstslocstrings)
* [Logging Command](#loggingcommand)
  * [Write-VstsAddAttachment](#write-vstsaddattachment)
  * [Write-VstsAddBuildTag](#write-vstsaddbuildtag)
  * [Write-VstsAssociateArtifact](#write-vstsassociateartifact)
  * [Write-VstsLogDetail](#write-vstslogdetail)
  * [Write-VstsLoggingCommand](#write-vstsloggingcommand)
  * [Write-VstsPrependPath](#write-vstsprependpath)
  * [Write-VstsSetEndpoint](#write-vstssetendpoint)
  * [Write-VstsSetProgress](#write-vstssetprogress)
  * [Write-VstsSetResult](#write-vstssetresult)
  * [Write-VstsSetSecret](#write-vstssetsecret)
  * [Write-VstsSetVariable](#write-vstssetvariable)
  * [Write-VstsTaskDebug](#write-vststaskdebug)
  * [Write-VstsTaskError](#write-vststaskerror)
  * [Write-VstsTaskVerbose](#write-vststaskverbose)
  * [Write-VstsTaskWarning](#write-vststaskwarning)
  * [Write-VstsUpdateBuildNumber](#write-vstsupdatebuildnumber)
  * [Write-VstsUpdateReleaseName](#write-vstsupdatereleasename)
  * [Write-VstsUploadArtifact](#write-vstsuploadartifact)
  * [Write-VstsUploadBuildLog](#write-vstsuploadbuildlog)
  * [Write-VstsUploadFile](#write-vstsuploadfile)
  * [Write-VstsUploadSummary](#write-vstsuploadsummary)
* [Server OM](#serverom)
  * [Get-VstsAssemblyReference](#get-vstsassemblyreference)
  * [Get-VstsClientCertificate](#get-vstsclientcertificate)
  * [Get-VstsTfsClientCredentials](#get-vststfsclientcredentials)
  * [Get-VstsTfsService](#get-vststfsservice)
  * [Get-VstsVssCredentials](#get-vstsvsscredentials)
  * [Get-VstsVssHttpClient](#get-vstsvsshttpclient)
  * [Get-VstsWebProxy](#get-vstswebproxy)
* [Tool](#tool)
  * [Assert-VstsAgent](#assert-vstsagent)
  * [Assert-VstsPath](#assert-vstspath)
  * [Invoke-VstsProcess](#invoke-vstsprocess)
  * [Invoke-VstsTool](#invoke-vststool)
* [Trace](#trace)
  * [Trace-VstsEnteringInvocation](#trace-vstsenteringinvocation)
  * [Trace-VstsLeavingInvocation](#trace-vstsleavinginvocation)
  * [Trace-VstsPath](#trace-vstspath)

## <a name="find" />Find
### <a name="find-vstsmatch" />Find-VstsMatch
[table of contents](#toc) | [full](FullHelp/Find-VstsMatch.md)
```
NAME
    Find-VstsMatch

SYNOPSIS
    Finds files using match patterns.

SYNTAX
    Find-VstsMatch [[-DefaultRoot] <String>] [[-Pattern] <String[]>] [[-FindOptions] <Object>]
    [[-MatchOptions] <Object>] [<CommonParameters>]

DESCRIPTION
    Determines the find root from a list of patterns. Performs the find and then applies the glob patterns.
    Supports interleaved exclude patterns. Unrooted patterns are rooted using defaultRoot, unless
    matchOptions.matchBase is specified and the pattern is a basename only. For matchBase cases, the
    defaultRoot is used as the find root.
```
### <a name="new-vstsfindoptions" />New-VstsFindOptions
[table of contents](#toc) | [full](FullHelp/New-VstsFindOptions.md)
```
NAME
    New-VstsFindOptions

SYNOPSIS
    Creates FindOptions for use with Find-VstsMatch.

SYNTAX
    New-VstsFindOptions [-FollowSpecifiedSymbolicLink] [-FollowSymbolicLinks] [<CommonParameters>]

DESCRIPTION
    Creates FindOptions for use with Find-VstsMatch. Contains switches to control whether to follow symlinks.
```
### <a name="new-vstsmatchoptions" />New-VstsMatchOptions
[table of contents](#toc) | [full](FullHelp/New-VstsMatchOptions.md)
```
NAME
    New-VstsMatchOptions

SYNOPSIS
    Creates MatchOptions for use with Find-VstsMatch and Select-VstsMatch.

SYNTAX
    New-VstsMatchOptions [-Dot] [-FlipNegate] [-MatchBase] [-NoBrace] [-NoCase] [-NoComment] [-NoExt]
    [-NoGlobStar] [-NoNegate] [-NoNull] [<CommonParameters>]

DESCRIPTION
    Creates MatchOptions for use with Find-VstsMatch and Select-VstsMatch. Contains switches to control which
    pattern matching options are applied.
```
### <a name="select-vstsmatch" />Select-VstsMatch
[table of contents](#toc) | [full](FullHelp/Select-VstsMatch.md)
```
NAME
    Select-VstsMatch

SYNOPSIS
    Applies match patterns against a list of files.

SYNTAX
    Select-VstsMatch [[-ItemPath] <String[]>] [[-Pattern] <String[]>] [[-PatternRoot] <String>] [[-Options]
    <Object>] [<CommonParameters>]

DESCRIPTION
    Applies match patterns to a list of paths. Supports interleaved exclude patterns.
```
## <a name="input" />Input
### <a name="get-vstsendpoint" />Get-VstsEndpoint
[table of contents](#toc) | [full](FullHelp/Get-VstsEndpoint.md)
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
```
### <a name="get-vstsinput" />Get-VstsInput
[table of contents](#toc) | [full](FullHelp/Get-VstsInput.md)
```
NAME
    Get-VstsInput

SYNOPSIS
    Gets an input.

SYNTAX
    Get-VstsInput -Name <String> [-Require] [-AsBool] [-AsInt] [<CommonParameters>]

    Get-VstsInput -Name <String> [-Default <Object>] [-AsBool] [-AsInt] [<CommonParameters>]

DESCRIPTION
    Gets the value for the specified input name.
```
### <a name="get-vstssecurefilename" />Get-VstsSecureFileName
[table of contents](#toc) | [full](FullHelp/Get-VstsSecureFileName.md)
```
NAME
    Get-VstsSecureFileName

SYNOPSIS
    Gets a secure file name.

SYNTAX
    Get-VstsSecureFileName [-Id] <String> [-Require] [<CommonParameters>]

DESCRIPTION
    Gets the name for a secure file.
```
### <a name="get-vstssecurefileticket" />Get-VstsSecureFileTicket
[table of contents](#toc) | [full](FullHelp/Get-VstsSecureFileTicket.md)
```
NAME
    Get-VstsSecureFileTicket

SYNOPSIS
    Gets a secure file ticket.

SYNTAX
    Get-VstsSecureFileTicket [-Id] <String> [-Require] [<CommonParameters>]

DESCRIPTION
    Gets the secure file ticket that can be used to download the secure file contents.
```
### <a name="get-vststaskvariable" />Get-VstsTaskVariable
[table of contents](#toc) | [full](FullHelp/Get-VstsTaskVariable.md)
```
NAME
    Get-VstsTaskVariable

SYNOPSIS
    Gets a task variable.

SYNTAX
    Get-VstsTaskVariable -Name <String> [-Require] [-AsBool] [-AsInt] [<CommonParameters>]

    Get-VstsTaskVariable -Name <String> [-Default <Object>] [-AsBool] [-AsInt] [<CommonParameters>]

DESCRIPTION
    Gets the value for the specified task variable.
```
### <a name="get-vststaskvariableinfo" />Get-VstsTaskVariableInfo
[table of contents](#toc) | [full](FullHelp/Get-VstsTaskVariableInfo.md)
```
NAME
    Get-VstsTaskVariableInfo

SYNOPSIS
    Gets all job variables available to the task. Requires 2.104.1 agent or higher.

SYNTAX
    Get-VstsTaskVariableInfo [<CommonParameters>]

DESCRIPTION
    Gets a snapshot of the current state of all job variables available to the task.
    Requires a 2.104.1 agent or higher for full functionality.

    Returns an array of objects with the following properties:
        [string]Name
        [string]Value
        [bool]Secret

    Limitations on an agent prior to 2.104.1:
     1) The return value does not include all public variables. Only public variables
        that have been added using setVariable are returned.
     2) The name returned for each secret variable is the formatted environment variable
        name, not the actual variable name (unless it was set explicitly at runtime using
        setVariable).
```
### <a name="set-vststaskvariable" />Set-VstsTaskVariable
[table of contents](#toc) | [full](FullHelp/Set-VstsTaskVariable.md)
```
NAME
    Set-VstsTaskVariable

SYNOPSIS
    Sets a task variable.

SYNTAX
    Set-VstsTaskVariable [-Name] <String> [[-Value] <String>] [-Secret] [<CommonParameters>]

DESCRIPTION
    Sets a task variable in the current task context as well as in the current job context. This allows the
    task variable to retrieved by subsequent tasks within the same job.
```
## <a name="legacyfind" />Legacy Find
### <a name="find-vstsfiles" />Find-VstsFiles
[table of contents](#toc) | [full](FullHelp/Find-VstsFiles.md)
```
NAME
    Find-VstsFiles

SYNOPSIS
    Finds files or directories.

SYNTAX
    Find-VstsFiles [[-LiteralDirectory] <String>] [-LegacyPattern] <String> [-IncludeFiles]
    [-IncludeDirectories] [-Force] [<CommonParameters>]

DESCRIPTION
    Finds files or directories using advanced pattern matching.
```
## <a name="localization" />Localization
### <a name="get-vstslocstring" />Get-VstsLocString
[table of contents](#toc) | [full](FullHelp/Get-VstsLocString.md)
```
NAME
    Get-VstsLocString

SYNOPSIS
    Gets a localized resource string.

SYNTAX
    Get-VstsLocString [-Key] <String> [[-ArgumentList] <Object[]>] [<CommonParameters>]

DESCRIPTION
    Gets a localized resource string and optionally formats the string with arguments.

    If the format fails (due to a bad format string or incorrect expected arguments in the format string),
    then the format string is returned followed by each of the arguments (delimited by a space).

    If the lookup key is not found, then the lookup key is returned followed by each of the arguments
    (delimited by a space).
```
### <a name="import-vstslocstrings" />Import-VstsLocStrings
[table of contents](#toc) | [full](FullHelp/Import-VstsLocStrings.md)
```
NAME
    Import-VstsLocStrings

SYNOPSIS
    Imports resource strings for use with GetVstsLocString.

SYNTAX
    Import-VstsLocStrings [-LiteralPath] <String> [<CommonParameters>]

DESCRIPTION
    Imports resource strings for use with GetVstsLocString. The imported strings are stored in an internal
    resource string dictionary. Optionally, if a separate resource file for the current culture exists, then
    the localized strings from that file then imported (overlaid) into the same internal resource string
    dictionary.

    Resource strings from the SDK are prefixed with "PSLIB_". This prefix should be avoided for custom
    resource strings.
```
## <a name="loggingcommand" />Logging Command
### <a name="write-vstsaddattachment" />Write-VstsAddAttachment
[table of contents](#toc) | [full](FullHelp/Write-VstsAddAttachment.md)
```
NAME
    Write-VstsAddAttachment

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsAddAttachment [-Type] <String> [-Name] <String> [-Path] <String> [-AsOutput]
    [<CommonParameters>]
```
### <a name="write-vstsaddbuildtag" />Write-VstsAddBuildTag
[table of contents](#toc) | [full](FullHelp/Write-VstsAddBuildTag.md)
```
NAME
    Write-VstsAddBuildTag

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsAddBuildTag [-Value] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsassociateartifact" />Write-VstsAssociateArtifact
[table of contents](#toc) | [full](FullHelp/Write-VstsAssociateArtifact.md)
```
NAME
    Write-VstsAssociateArtifact

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsAssociateArtifact [-Name] <String> [-Path] <String> [-Type] <String> [[-Properties]
    <Hashtable>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstslogdetail" />Write-VstsLogDetail
[table of contents](#toc) | [full](FullHelp/Write-VstsLogDetail.md)
```
NAME
    Write-VstsLogDetail

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsLogDetail [-Id] <Guid> [[-ParentId] <Object>] [[-Type] <String>] [[-Name] <String>] [[-Order]
    <Object>] [[-StartTime] <Object>] [[-FinishTime] <Object>] [[-Progress] <Object>] [[-State] <Object>]
    [[-Result] <Object>] [[-Message] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsloggingcommand" />Write-VstsLoggingCommand
[table of contents](#toc) | [full](FullHelp/Write-VstsLoggingCommand.md)
```
NAME
    Write-VstsLoggingCommand

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsLoggingCommand -Area <String> -Event <String> [-Data <String>] [-Properties <Hashtable>]
    [-AsOutput] [<CommonParameters>]

    Write-VstsLoggingCommand -Command <Object> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsprependpath" />Write-VstsPrependPath
[table of contents](#toc) | [full](FullHelp/Write-VstsPrependPath.md)
```
NAME
    Write-VstsPrependPath

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsPrependPath [-Path] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstssetendpoint" />Write-VstsSetEndpoint
[table of contents](#toc) | [full](FullHelp/Write-VstsSetEndpoint.md)
```
NAME
    Write-VstsSetEndpoint

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetEndpoint [-Id] <String> [-Field] <String> [-Key] <String> [-Value] <String> [-AsOutput]
    [<CommonParameters>]
```
### <a name="write-vstssetprogress" />Write-VstsSetProgress
[table of contents](#toc) | [full](FullHelp/Write-VstsSetProgress.md)
```
NAME
    Write-VstsSetProgress

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetProgress [-Percent] <Int32> [[-CurrentOperation] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstssetresult" />Write-VstsSetResult
[table of contents](#toc) | [full](FullHelp/Write-VstsSetResult.md)
```
NAME
    Write-VstsSetResult

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetResult -Result <String> [-Message <String>] [-AsOutput] [<CommonParameters>]

    Write-VstsSetResult -Result <String> [-Message <String>] [-DoNotThrow] [<CommonParameters>]
```
### <a name="write-vstssetsecret" />Write-VstsSetSecret
[table of contents](#toc) | [full](FullHelp/Write-VstsSetSecret.md)
```
NAME
    Write-VstsSetSecret

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetSecret [-Value] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstssetvariable" />Write-VstsSetVariable
[table of contents](#toc) | [full](FullHelp/Write-VstsSetVariable.md)
```
NAME
    Write-VstsSetVariable

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetVariable [-Name] <String> [[-Value] <String>] [-Secret] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskdebug" />Write-VstsTaskDebug
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskDebug.md)
```
NAME
    Write-VstsTaskDebug

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskDebug [[-Message] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskerror" />Write-VstsTaskError
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskError.md)
```
NAME
    Write-VstsTaskError

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskError [[-Message] <String>] [[-ErrCode] <String>] [[-SourcePath] <String>] [[-LineNumber]
    <String>] [[-ColumnNumber] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskverbose" />Write-VstsTaskVerbose
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskVerbose.md)
```
NAME
    Write-VstsTaskVerbose

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskVerbose [[-Message] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskwarning" />Write-VstsTaskWarning
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskWarning.md)
```
NAME
    Write-VstsTaskWarning

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskWarning [[-Message] <String>] [[-ErrCode] <String>] [[-SourcePath] <String>] [[-LineNumber]
    <String>] [[-ColumnNumber] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsupdatebuildnumber" />Write-VstsUpdateBuildNumber
[table of contents](#toc) | [full](FullHelp/Write-VstsUpdateBuildNumber.md)
```
NAME
    Write-VstsUpdateBuildNumber

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUpdateBuildNumber [-Value] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsupdatereleasename" />Write-VstsUpdateReleaseName
[table of contents](#toc) | [full](FullHelp/Write-VstsUpdateReleaseName.md)
```
NAME
    Write-VstsUpdateReleaseName

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUpdateReleaseName [-Name] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsuploadartifact" />Write-VstsUploadArtifact
[table of contents](#toc) | [full](FullHelp/Write-VstsUploadArtifact.md)
```
NAME
    Write-VstsUploadArtifact

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUploadArtifact [-ContainerFolder] <String> [-Name] <String> [-Path] <String> [-AsOutput]
    [<CommonParameters>]
```
### <a name="write-vstsuploadbuildlog" />Write-VstsUploadBuildLog
[table of contents](#toc) | [full](FullHelp/Write-VstsUploadBuildLog.md)
```
NAME
    Write-VstsUploadBuildLog

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUploadBuildLog [-Path] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsuploadfile" />Write-VstsUploadFile
[table of contents](#toc) | [full](FullHelp/Write-VstsUploadFile.md)
```
NAME
    Write-VstsUploadFile

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUploadFile [-Path] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsuploadsummary" />Write-VstsUploadSummary
[table of contents](#toc) | [full](FullHelp/Write-VstsUploadSummary.md)
```
NAME
    Write-VstsUploadSummary

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUploadSummary [-Path] <String> [-AsOutput] [<CommonParameters>]
```
## <a name="serverom" />Server OM
### <a name="get-vstsassemblyreference" />Get-VstsAssemblyReference
[table of contents](#toc) | [full](FullHelp/Get-VstsAssemblyReference.md)
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

    See https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for
    reliable usage when working with the TFS extended client SDK from a task.
```
### <a name="get-vstsclientcertificate" />Get-VstsClientCertificate
[table of contents](#toc) | [full](FullHelp/Get-VstsClientCertificate.md)
```
NAME
    Get-VstsClientCertificate

SYNOPSIS
    Gets a client certificate for current connected TFS instance

SYNTAX
    Get-VstsClientCertificate [<CommonParameters>]

DESCRIPTION
    Gets an instance of a X509Certificate2 that is the client certificate Build/Release agent used.
```
### <a name="get-vststfsclientcredentials" />Get-VstsTfsClientCredentials
[table of contents](#toc) | [full](FullHelp/Get-VstsTfsClientCredentials.md)
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
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable
    usage when working with the TFS extended client SDK from a task.
```
### <a name="get-vststfsservice" />Get-VstsTfsService
[table of contents](#toc) | [full](FullHelp/Get-VstsTfsService.md)
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
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable
    usage when working with the TFS extended client SDK from a task.
```
### <a name="get-vstsvsscredentials" />Get-VstsVssCredentials
[table of contents](#toc) | [full](FullHelp/Get-VstsVssCredentials.md)
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
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable
    usage when working with the VSTS REST SDK from a task.
```
### <a name="get-vstsvsshttpclient" />Get-VstsVssHttpClient
[table of contents](#toc) | [full](FullHelp/Get-VstsVssHttpClient.md)
```
NAME
    Get-VstsVssHttpClient

SYNOPSIS
    Gets a VSS HTTP client.

SYNTAX
    Get-VstsVssHttpClient [-TypeName] <String> [[-OMDirectory] <String>] [[-Uri] <String>] [[-VssCredentials]
    <Object>] [[-WebProxy] <Object>] [[-ClientCert] <Object>] [-IgnoreSslError] [<CommonParameters>]

DESCRIPTION
    Gets an instance of an VSS HTTP client.

    *** DO NOT USE Agent.ServerOMDirectory *** See
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable
    usage when working with the VSTS REST SDK from a task.
```
### <a name="get-vstswebproxy" />Get-VstsWebProxy
[table of contents](#toc) | [full](FullHelp/Get-VstsWebProxy.md)
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
```
## <a name="tool" />Tool
### <a name="assert-vstsagent" />Assert-VstsAgent
[table of contents](#toc) | [full](FullHelp/Assert-VstsAgent.md)
```
NAME
    Assert-VstsAgent

SYNOPSIS
    Asserts the agent version is at least the specified minimum.

SYNTAX
    Assert-VstsAgent [-Minimum] <Version> [<CommonParameters>]
```
### <a name="assert-vstspath" />Assert-VstsPath
[table of contents](#toc) | [full](FullHelp/Assert-VstsPath.md)
```
NAME
    Assert-VstsPath

SYNOPSIS
    Asserts that a path exists. Throws if the path does not exist.

SYNTAX
    Assert-VstsPath [-LiteralPath] <String> [[-PathType] {Any | Container | Leaf}] [-PassThru]
    [<CommonParameters>]
```
### <a name="invoke-vstsprocess" />Invoke-VstsProcess
[table of contents](#toc) | [full](FullHelp/Invoke-VstsProcess.md)
```
NAME
    Invoke-VstsProcess

SYNOPSIS
    Executes an external program as a child process.

SYNTAX
    Invoke-VstsProcess [-FileName] <String> [[-Arguments] <String>] [[-WorkingDirectory] <String>]
    [[-StdOutPath] <String>] [[-StdErrPath] <String>] [-RequireExitCodeZero] [<CommonParameters>]

DESCRIPTION
    Executes an external program and waits for the process to exit.

    After calling this command, the exit code of the process can be retrieved from the variable $LASTEXITCODE
    or from the pipe.
```
### <a name="invoke-vststool" />Invoke-VstsTool
[table of contents](#toc) | [full](FullHelp/Invoke-VstsTool.md)
```
NAME
    Invoke-VstsTool

SYNOPSIS
    Executes an external program.

SYNTAX
    Invoke-VstsTool [-FileName] <String> [[-Arguments] <String>] [[-WorkingDirectory] <String>] [[-Encoding]
    <Encoding>] [-RequireExitCodeZero] [[-IgnoreHostException] <Boolean>] [<CommonParameters>]

DESCRIPTION
    Executes an external program and waits for the process to exit.

    After calling this command, the exit code of the process can be retrieved from the variable $LASTEXITCODE.
```
## <a name="trace" />Trace
### <a name="trace-vstsenteringinvocation" />Trace-VstsEnteringInvocation
[table of contents](#toc) | [full](FullHelp/Trace-VstsEnteringInvocation.md)
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
```
### <a name="trace-vstsleavinginvocation" />Trace-VstsLeavingInvocation
[table of contents](#toc) | [full](FullHelp/Trace-VstsLeavingInvocation.md)
```
NAME
    Trace-VstsLeavingInvocation

SYNOPSIS
    Writes verbose information about the invocation being left.

SYNTAX
    Trace-VstsLeavingInvocation [-InvocationInfo] <InvocationInfo> [<CommonParameters>]

DESCRIPTION
    Used to trace verbose information when leaving a function/script. Writes a leaving message followed by a
    short description of the invocation.
```
### <a name="trace-vstspath" />Trace-VstsPath
[table of contents](#toc) | [full](FullHelp/Trace-VstsPath.md)
```
NAME
    Trace-VstsPath

SYNOPSIS
    Writes verbose information about paths.

SYNTAX
    Trace-VstsPath [[-Path] <String[]>] [-PassThru] [<CommonParameters>]

DESCRIPTION
    Writes verbose information about the paths. The paths are sorted and a the common root is written only
    once, followed by each relative path.
```

