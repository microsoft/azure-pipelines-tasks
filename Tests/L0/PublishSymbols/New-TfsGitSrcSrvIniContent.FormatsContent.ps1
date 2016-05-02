[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SrcSrvIniContentFunctions.ps1
$provider = New-Object psobject -Property @{
        CollectionUrl = 'Some collection URL'
        CommitId = 'Some commit ID'
        RepoId = 'Some repo ID'
        TeamProjectId = 'Some team project ID'
        SourcesRootPath = 'SomeDrive:\SomeRoot\\\' # Function should handle trimming trailing slashes.
    }
$sourceFiles = @(
    'SomeDrive:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs'
    'SomeDrive:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs'
)
$script:now = Get-Date
Register-Mock Get-Date { $script:now }

# Act.
$actual = New-TfsGitSrcSrvIniContent -Provider $provider -SourceFilePaths $sourceFiles

# Assert.
$expected = @(
    'SRCSRV: ini ------------------------------------------------'
    'VERSION=3'
    'INDEXVERSION=2'
    'VERCTRL=Team Foundation Server'
    [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
        ($now))
    'INDEXER=TFSTB'
    'SRCSRV: variables ------------------------------------------'
    "TFS_EXTRACT_TARGET=%targ%\%var5%\%fnvar%(%var6%)%fnbksl%(%var7%)"
    "TFS_EXTRACT_CMD=tf.exe git view /collection:%fnvar%(%var2%) /teamproject:""%fnvar%(%var3%)"" /repository:""%fnvar%(%var4%)"" /commitId:%fnvar%(%var5%) /path:""%var7%"" /output:%SRCSRVTRG% %fnvar%(%var8%)"
    "TFS_COLLECTION=Some collection URL"
    "TFS_TEAM_PROJECT=Some team project ID"
    "TFS_REPO=Some repo ID"
    "TFS_COMMIT=Some commit ID"
    "TFS_SHORT_COMMIT=Some com"
    "TFS_APPLY_FILTERS=/applyfilters"
    'SRCSRVVERCTRL=git'
    'SRCSRVERRDESC=access'
    'SRCSRVERRVAR=var2'
    'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
    'SRCSRVCMD=%TFS_EXTRACT_CMD%'
    'SRCSRV: source files ---------------------------------------'
    "SomeDrive:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs*TFS_COLLECTION*TFS_TEAM_PROJECT*TFS_REPO*TFS_COMMIT*TFS_SHORT_COMMIT*/SomeSolution/SomeProject/SomeSource.cs*TFS_APPLY_FILTERS"
    "SomeDrive:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs*TFS_COLLECTION*TFS_TEAM_PROJECT*TFS_REPO*TFS_COMMIT*TFS_SHORT_COMMIT*/AnotherSolution/AnotherProject/AnotherSource.cs*TFS_APPLY_FILTERS"
    'SRCSRV: end ------------------------------------------------'
)
Assert-AreEqual $expected $actual
