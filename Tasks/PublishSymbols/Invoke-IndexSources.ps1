[cmdletbinding()]
param(
    [string[]]$SymbolsFilePaths = $(throw 'Missing SymbolsFilePaths'),
    [bool]$TreatNotIndexedAsWarning = $(throw 'Missing TreatNotIndexedAsWarning')
)

# For pre-M88 agents, get the method info for DbgHelpWrapper.GetIndexedSources(...).
# The method info is used by the function Get-SourceFilePaths. Since reflection is
# expensive, we do this exactly once outside the scope of the function rather than
# each time the function executes.
[hashtable]$splat = @{
    'Name' = 'Get-IndexedSourceFilePaths'
    'Module' = 'Microsoft.TeamFoundation.DistributedTask.Task.Internal'
    'ErrorAction' = 'SilentlyContinue'
}
if (!(Get-Command @splat)) {
    Write-Verbose 'Command not found: Get-IndexedSourceFilePaths'
    
    # Get the dbgHelpWrapper type.
    # Because the type's access modifier is 'internal', we have to load it from
    # the assembly rather than using the PowerShell type syntax.
    $taskInternalAssembly =
        Get-Module -Name 'Microsoft.TeamFoundation.DistributedTask.Task.Internal' |
        Select-Object -ExpandProperty 'ImplementingAssembly'
    $dbgHelpWrapperType = $taskInternalAssembly.GetType(
        'Microsoft.TeamFoundation.DistributedTask.Task.Internal.Core.DbgHelpWrapper', #name
        $true, # throwOnError
        $false) # ignoreCase

    # Because the GetIndexedSources method's access modifier is internal, we have
    # to load it via reflection.
    $getIndexedSourcesMethodInfo = $dbgHelpWrapperType.GetMethod(
        'GetIndexedSources', # name
        [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic) # bindingFlags
}

function Get-SourceFilePaths {
    [cmdletbinding()]
    param(
        [string]$SymbolsFilePath = $(throw 'Missing SymbolsFilePath'),
        [string]$SourcesRootPath = $(throw 'Missing SourcesRootPath'),
        [bool]$TreatNotIndexedAsWarning = $(throw 'Missing TreatNotIndexedAsWarning')
    )

    # Validate the symbols file exists.
    if (!(Test-Path -LiteralPath $SymbolsFilePath -PathType Leaf)) {
        throw (Get-LocalizedString -Key 'The file {0} could not be found.' -ArgumentList $SymbolsFilePath)
    }

    # Get the referenced source file paths.
    [string[]]$sourceFilePaths = $null
    if (!$getIndexedSourcesMethodInfo) {
        $sourceFilePaths = Get-IndexedSourceFilePaths -SymbolsFilePath $SymbolsFilePath
    } else {
        # Agent is pre-M88.
        $dbgHelpWrapper = $dbgHelpWrapperType.GetConstructors()[0].Invoke($null)
        try {
            $sourceFilePaths = $getIndexedSourcesMethodInfo.Invoke($dbgHelpWrapper, @( $SymbolsFilePath ))
        }
        finally {
            $dbgHelpWrapper.Dispose()
        }
    }

    # Warn if no source file paths were contained in the PDF file.
    if (!$sourceFilePaths) {
        [string]$message = (Get-LocalizedString -Key 'Unable to index file ''{0}''. The file does not contain any source file paths.' -ArgumentList $SymbolsFilePath)
        if ($TreatNotIndexedAsWarning) {
            Write-Warning $message
        } else {
            Write-Host $message
        }

        return
    }

    # Make the sources root path end with a trailing slash.
    $SourcesRootPath = $SourcesRootPath.TrimEnd('\')
    $SourcesRootPath = "$SourcesRootPath\"

    [bool]$isPreambleWritten = $false
    foreach ($sourceFilePath in $sourceFilePaths) {
        # Trim the source file path.
        $sourceFilePath = $sourceFilePath.Trim()

        # Check whether the source file is under sources root.
        [bool]$isUnderSourcesRoot = $sourceFilePath.StartsWith(
            $SourcesRootPath,
            [System.StringComparison]::OrdinalIgnoreCase)

        # Check whether the source file exists.
        [bool]$isFound =
            $isUnderSourcesRoot -and
            (Test-Path -LiteralPath $sourceFilePath -PathType Leaf)

        # Warn if issues.
        if ((!$isUnderSourcesRoot) -or (!$isFound)) {
            # Warn with preamble message if the preamble has not already been printed.
            if (!$isPreambleWritten) {
                [string]$message = (Get-LocalizedString -Key 'Unable to index one or more source files for symbols file: {0}' -ArgumentList $SymbolsFilePath)
                if ($TreatNotIndexedAsWarning) {
                    Write-Warning $message
                } else  {
                    Write-Host $message
                }
            }

            # Set the flag indicating that the preamble warning has been printed.
            $isPreambleWritten = $true

            if (!$isUnderSourcesRoot) {
                # Warn that the source file path is not under the sources root.
                [string]$message = (Get-LocalizedString -Key 'The source file path falls outside of the sources root directory. Source file path ''{0}''. Sources root directory ''{1}''.' -ArgumentList $sourceFilePath, $SourcesRootPath)
                if ($TreatNotIndexedAsWarning) {
                    Write-Warning $message
                } else {
                    Write-Host $message
                }
            } elseif (!$isFound) {
                # Warn that the source file does not exist.
                [string]$message = (Get-LocalizedString -Key 'Source file not found: {0}' -ArgumentList $sourceFilePath)
                if ($TreatNotIndexedAsWarning) {
                    Write-Warning $message
                } else {
                    Write-Host $message
                }
            } else {
                throw 'Not supported' # Execution should never reach here.
            }

            # Prevent the source file path from being output.
            continue
        }

        # Output the source file path.
        $sourceFilePath
    }
}

function New-TfsGitSrcSrvIniContent {
    [cmdletbinding()]
    param(
        [string]$CollectionUrl = $(throw 'Missing CollectionUrl'),
        [string]$TeamProjectId = $(throw 'Missing TeamProjectId'),
        [string]$RepoId = $(throw 'Missing RepoId'),
        [string]$CommitId = $(throw 'Missing CommitId'),
        [string]$SourcesRootPath = $(throw 'Missing SourcesRootPath'),
        [string[]]$SourceFilePaths = $(throw 'Missing SourceFilePaths')
    )

    # For more information, see:
    # https://msdn.microsoft.com/en-us/library/windows/hardware/ff558876(v=vs.85).aspx
    # https://msdn.microsoft.com/en-us/library/windows/desktop/ms680641(v=vs.85).aspx
    # http://www.codeproject.com/Articles/115125/Source-Indexing-and-Symbol-Servers-A-Guide-to-Easi
    'SRCSRV: ini ------------------------------------------------'
    'VERSION=3'
    'INDEXVERSION=2'
    'VERCTRL=Team Foundation Server'
    [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
        (Get-Date))
    'INDEXER=TFSTB'
    'SRCSRV: variables ------------------------------------------'
    # Assigning values to variables in the variables section - e.g. the variable
    # TFS_COLLECTION - allows for the variable to be overridden at debugging time.
    # For example, if the source code moves to a different collection URL altogether,
    # then at debugging time the TFS_COLLECTION variable can be overridden.
    #
    # Use the short commit hash in the target file path to alleviate max path issues.
    "TFS_EXTRACT_TARGET=%targ%\%var5%\%fnvar%(%var6%)%fnbksl%(%var7%)"
    # The "commitId" arg requires the full commit ID.
    #
    # The /applyfilters switch indicates whether to conver LF to CRLF. The source file hashes are
    # embedded in the PDB files and the debugger will reject the source file as a match if the
    # downloaded file's hash doesn't match the hash embedded in the PDB file. We make the assumption
    # the PDB was built from a source file with CRLFs. In some edge case were this is not true, the
    # variable TFS_APPLY_FILTERS can be overridden at debugging time.
    "TFS_EXTRACT_CMD=tf.exe git view /collection:%fnvar%(%var2%) /teamproject:""%fnvar%(%var3%)"" /repository:""%fnvar%(%var4%)"" /commitId:%fnvar%(%var5%) /path:""%var7%"" /output:%SRCSRVTRG% %fnvar%(%var8%)"
    "TFS_COLLECTION=$CollectionUrl"
    "TFS_TEAM_PROJECT=$TeamProjectId"
    "TFS_REPO=$RepoId"
    "TFS_COMMIT=$CommitId"
    "TFS_SHORT_COMMIT=$($CommitId.Substring(0, 8))" # Take the first 8 chars only.
    "TFS_APPLY_FILTERS=/applyfilters"
    'SRCSRVVERCTRL=git'
    'SRCSRVERRDESC=access'
    'SRCSRVERRVAR=var2'
    'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
    'SRCSRVCMD=%TFS_EXTRACT_CMD%'
    'SRCSRV: source files ---------------------------------------'
    # Make the sources root path end with a trailing slash.
    $SourcesRootPath = $SourcesRootPath.TrimEnd('\')
    $SourcesRootPath = "$SourcesRootPath\"
    foreach ($sourceFilePath in $SourceFilePaths) {
        [string]$relativeSourceFilePath = $sourceFilePath.Substring($SourcesRootPath.Length)
        $relativeSourceFilePath = $relativeSourceFilePath.Replace('\', '/')
        $relativeSourceFilePath = "/$relativeSourceFilePath"
        "$sourceFilePath*TFS_COLLECTION*TFS_TEAM_PROJECT*TFS_REPO*TFS_COMMIT*TFS_SHORT_COMMIT*$relativeSourceFilePath*TFS_APPLY_FILTERS"
    }

    'SRCSRV: end ------------------------------------------------'
}

function New-TfsVersionControlSrcSrvIniContent {
    [cmdletbinding()]
    param(
        [string]$PublicCollectionUrl = $(throw 'Missing PublicCollectionUrl'),
        $Workspace = $(throw 'Missing Workspace'),
        [string[]]$SourceFilePaths = $(throw 'Missing SourceFilePaths')
    )

    'SRCSRV: ini ------------------------------------------------'
    'VERSION=3'
    'INDEXVERSION=2'
    'VERCTRL=Team Foundation Server'
    [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
        (Get-Date))
    'INDEXER=TFSTB'
    'SRCSRV: variables ------------------------------------------'
    'TFS_EXTRACT_CMD=tf.exe view /version:%var4% /noprompt "$%var3%" /server:%fnvar%(%var2%) /console > %SRCSRVTRG%'
    'TFS_EXTRACT_TARGET=%targ%\%var2%%fnbksl%(%var3%)\%var4%\%fnfile%(%var5%)'
    'SRCSRVVERCTRL=tfs'
    'SRCSRVERRDESC=access'
    'SRCSRVERRVAR=var2'
    "VSTFSSERVER=$PublicCollectionUrl"
    'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
    'SRCSRVCMD=%TFS_EXTRACT_CMD%'
    'SRCSRV: source files ---------------------------------------'
    $itemSpecs =
        $SourceFilePaths |
        ForEach-Object { New-Object -TypeName 'Microsoft.TeamFoundation.VersionControl.Client.ItemSpec' -ArgumentList $_, 'None' }
    # The type returned by GetLocalVersions(...) is LocalVersion[][].
    $localVersions = $Workspace.GetLocalVersions(
        $itemSpecs, # itemSpecs
        $false); # sortData
    foreach ($localVersion in $localVersions) {
        if (!$localVersion) {
            continue
        }

        [string]$localPath = $localVersion[0].Item
        Write-Verbose "Local path: $localPath"
        [string]$serverPath = $Workspace.GetServerItemForLocalItem($localPath).Substring(1) # Everything but the '$'.
        [int]$version = $localVersion[0].Version
        [string]$fileName = Split-Path -Leaf -Path $localPath
        "$localPath*VSTFSSERVER*$serverPath*$version*$fileName"
    }
    
    'SRCSRV: end ------------------------------------------------'
}

# Validate at least one symbols file.
if (!$SymbolsFilePaths) {
    Write-Warning (Get-LocalizedString -Key 'No files were selected for indexing.');
    return
}

# Resolve location of pdbstr.exe.
[string]$pdbstrPath = Get-ToolPath -Name 'Pdbstr\pdbstr.exe'
if (!$pdbstrPath) {
    throw (Get-LocalizedString 'Could not find pdbstr.exe')
}

# Set source provider information.
[string]$provider = $env:BUILD_REPOSITORY_PROVIDER
[string]$teamProjectId = $env:SYSTEM_TEAMPROJECTID
[string]$sourcesRootPath = $env:BUILD_SOURCESDIRECTORY

# For consistency with the previous implementation, set the working directory to the temp folder
# before calling pdbstr.exe.
Push-Location $env:TEMP
$tfsTeamProjectCollection = $null
try {
    # Set the provider specific information.
    switch ($provider) {
        'TfsGit' {
            [string]$collectionUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI".TrimEnd('/')
            [string]$repoId = $env:BUILD_REPOSITORY_ID
            if (!$repoId) {
                # BUILD_REPOSITORY_ID was added in M88. Fallback to name if not available.
                $repoId = $env:BUILD_REPOSITORY_NAME # Get the referenced source files.
            }

            [string]$commitId = $env:BUILD_SOURCEVERSION
            break
        }
        'TfsVersionControl' {
            # TODO: WHERE DOES THE distributedTaskContext VARIABLE COME FROM? GLOBAL SCOPE? AGENT SETS THIS?
            $serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $env:BUILD_REPOSITORY_NAME
            [hashtable]$splat = @{
                'Name' = 'Get-TfsClientCredentials'
                'Module' = 'Microsoft.TeamFoundation.DistributedTask.Task.Internal'
                'ErrorAction' = 'SilentlyContinue'
            }
            if (Get-Command @splat) {
                $tfsClientCredentials = Get-TfsClientCredentials -ServiceEndpoint $serviceEndpoint
            } else {
                # For pre-M88 agents, get the TFS client credentials in a hacky way.
                Write-Verbose 'Command not found: Get-TfsClientCredentials'
                [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.DistributedTask.Agent.Common.dll") | Out-Null
                $tfsClientCredentials =
                    [Microsoft.TeamFoundation.DistributedTask.Agent.Common.CredentialsExtensions]::GetTfsClientCredentials(
                        $serviceEndpoint)
            }

            [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.Client.dll") | Out-Null
            [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.Common.dll") | Out-Null
            [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.VersionControl.Client.dll") | Out-Null
            $tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection(
                $serviceEndpoint.Url,
                $tfsClientCredentials)
            $versionControlServer = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer])
            $workspace = $versionControlServer.TryGetWorkspace($sourcesRootPath)
            if (!$workspace) {
                # TODO: SHOULDN'T THIS BE AN ERROR? THIS SHOULD NEVER HAPPEN.
                Write-Warning (Get-LocalizedString -Key 'Unable to determine workspace from source folder ''{0}''.' -ArgumentList $sourcesRootPath)
                return
            }

            # When the build service runs on the same box as the AT, we use localhost
            # to connect to the AT.  This is not appropriate for storing inside of a PDB that will
            # be used on another box, so we have to look up a more durable URL.
            $locationService = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.Framework.Client.ILocationService])
            # Retrieve a URI to the location service.
            [string]$publicCollectionUrl = $locationService.LocationForAccessMapping(
                [Microsoft.TeamFoundation.ServiceInterfaces]::LocationService,
                [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::SelfReferenceLocationServiceIdentifier,
                $locationService.DefaultAccessMapping)
            # Remove the location service part to form a collection URI.
            if ($publicCollectionUrl.EndsWith(
                    [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::CollectionLocationServiceRelativePath,
                    [System.StringComparison]::OrdinalIgnoreCase)) {
                $publicCollectionUrl = $publicCollectionUrl.Substring(
                    0,
                    $publicCollectionUrl.Length - [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::CollectionLocationServiceRelativePath.Length)
            } else {
                # TODO: SHOULD THIS REVERT TO ENV VAR?
            }

            break
        }
        default {
            Write-Warning (Get-LocalizedString -Key 'Only TfsGit and TfsVersionControl source providers are supported for source indexing. Repository type: {0}' -ArgumentList $provider)
            Write-Warning (Get-LocalizedString -Key 'Unable to index sources.')
            return
        }
    }

    # Index the source files
    foreach ($symbolsFilePath in $SymbolsFilePaths) {
        Write-Verbose "Symbols file: $symbolsFilePath"

        # Get the source file paths embedded in the symbols file.
        [hashtable]$splat = @{
            'SymbolsFilePath' = $symbolsFilePath
            'SourcesRootPath' = $sourcesRootPath
            'TreatNotIndexedAsWarning' = $TreatNotIndexedAsWarning
        }
        [string[]]$sourceFilePaths =
            Get-SourceFilePaths @splat |
            ForEach-Object {
                Write-Verbose "Source file: $_"
                $_
            }
        if (!$sourceFilePaths) {
            continue
        }

        # Get the content for the source server INI file.
        switch ($provider) {
            'TfsGit' {
                [hashtable]$splat = @{
                    # TODO: WHY DOESN'T THIS USE THE "PUBLIC COLLECTION URL" LIKE TFVC?
                    'CollectionUrl' = $collectionUrl
                    'TeamProjectId' = $teamProjectId
                    'RepoId' = $repoId
                    'CommitId' = $commitId
                    'SourcesRootPath' = $sourcesRootPath
                    'SourceFilePaths' = $sourceFilePaths
                }
                [string[]]$srcSrvIniContent = New-TfsGitSrcSrvIniContent @splat
                break
            }
            'TfsVersionControl' {
                [hashtable]$splat = @{
                    'PublicCollectionUrl' = $publicCollectionUrl
                    'Workspace' = $workspace
                    'SourceFilePaths' = $sourceFilePaths
                }
                [string[]]$srcSrvIniContent = New-TfsVersionControlSrcSrvIniContent @splat
                break
            }
            default {
                throw 'Not supported.' # Execution should never reach here.
            }
        }

        # For consistency with previous implementation, append a blank line so that the content
        # gets written with a trailing new-line.
        $srcSrvIniContent += ''
        [string]$srcSrvIniContent = [string]::Join([System.Environment]::NewLine, $srcSrvIniContent)

        $tempSrcSrvIniFile = Get-Item -LiteralPath ([System.IO.Path]::GetTempFileName())
        try {
            # For encoding consistency with previous implementation, using File.WriteAllText(...) instead
            # of Out-File.
            [System.IO.File]::WriteAllText($tempSrcSrvIniFile.FullName, $srcSrvIniContent)
            Write-Verbose "Wrote srcsrv.ini information to: $($tempSrcSrvIniFile.FullName)"

            # Call pdbstr.exe.
            [string[]]$pdbStrArgs = @(
                '-w'
                "-p:""$symbolsFilePath"""
                "-i:""$($tempSrcSrvIniFile.FullName)"""
                '-s:srcsrv'
            )
            Write-Verbose "$pdbstrPath $pdbStrArgs"
            # Redirect STDOUT to the verbose pipeline.
            # Let STDERR output to the error pipeline.
            & $pdbstrPath $pdbStrArgs |
                ForEach-Object { Write-Verbose $_ }
            Write-Verbose "pdbstr.exe exit code: $LASTEXITCODE"
            # TODO: Should we error if the exit code is not 0? Need to investigate.
        }
        finally {
            $tempSrcSrvIniFile.Delete()
        }
    }
}
finally {
    if ($tfsTeamProjectCollection) {
        Write-Verbose 'Disposing tfsTeamProjectCollection'
        $tfsTeamProjectCollection.Dispose()
    }
}