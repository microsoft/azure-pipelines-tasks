[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SrcSrvIniContentFunctions.ps1
$provider = New-Object psobject -Property @{
        PublicCollectionUrl = 'Some public collection URL'
        SourcesRootPath = 'SomeDrive:\SomeRoot\\\' # Function should handle trimming trailing slashes.
        Workspace = New-Object psobject
    }
$sourceFiles = @(
    'SomeDrive:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs'
    'SomeDrive:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs'
)
$script:now = Get-Date
Register-Mock Get-Date { $script:now }
Register-Mock New-ItemSpec { 'Some item spec 1' } -- -LocalPath 'SomeDrive:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs'
Register-Mock New-ItemSpec { 'Some item spec 2' } -- -LocalPath 'SomeDrive:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs'
$provider.Workspace |
    Add-Member -MemberType ScriptMethod -Name GetLocalVersions -Value {
            $expected = @(
                ,('Some item spec 1', 'Some item spec 2')
                $false
            )
            Assert-AreEqual $expected $args
            $jaggedArray = [System.Array]::CreateInstance([object[]], 2)
            $jaggedArray[0] = [System.Array]::CreateInstance([object], 1)
            $jaggedArray[0][0] = New-Object psobject -Property @{
                    Item = 'LocalVersion:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs'
                    Version = 1
                }
            $jaggedArray[1] = [System.Array]::CreateInstance([object], 1)
            $jaggedArray[1][0] = New-Object psobject -Property @{
                    Item = 'LocalVersion:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs'
                    Version = 2
                }
            $jaggedArray
        }
$provider.Workspace |
    Add-Member -MemberType ScriptMethod -Name GetServerItemForLocalItem -Value {
            Assert-AreEqual 1 $args.Count
            switch ($args[0]) {
                'LocalVersion:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs' {
                    '$/SomeTeamProject/SomeSolution/SomeProject/SomeSource.cs'
                    break
                }
                'LocalVersion:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs' {
                    '$/AnotherTeamProject/AnotherSolution/AnotherProject/AnotherSource.cs'
                    break
                }
                default { throw "Unexpected argument: $($args[0])" }
            }
        }


# Act.
$actual = New-TfvcSrcSrvIniContent -Provider $provider -SourceFilePaths $sourceFiles

# Assert.
$expected = @(
    'SRCSRV: ini ------------------------------------------------'
    'VERSION=3'
    'INDEXVERSION=2'
    'VERCTRL=Team Foundation Server'
    [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
        $script:now)
    'INDEXER=TFSTB'
    'SRCSRV: variables ------------------------------------------'
    'TFS_EXTRACT_CMD=tf.exe view /version:%var4% /noprompt "$%var3%" /server:%fnvar%(%var2%) /console > %SRCSRVTRG%'
    'TFS_EXTRACT_TARGET=%targ%\%var2%%fnbksl%(%var3%)\%var4%\%fnfile%(%var5%)'
    'SRCSRVVERCTRL=tfs'
    'SRCSRVERRDESC=access'
    'SRCSRVERRVAR=var2'
    "VSTFSSERVER=Some public collection URL"
    'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
    'SRCSRVCMD=%TFS_EXTRACT_CMD%'
    'SRCSRV: source files ---------------------------------------'
    "LocalVersion:\SomeRoot\SomeSolution\SomeProject\SomeSource.cs*VSTFSSERVER*/SomeTeamProject/SomeSolution/SomeProject/SomeSource.cs*1*SomeSource.cs"
    "LocalVersion:\SomeRoot\AnotherSolution\AnotherProject\AnotherSource.cs*VSTFSSERVER*/AnotherTeamProject/AnotherSolution/AnotherProject/AnotherSource.cs*2*AnotherSource.cs"
    'SRCSRV: end ------------------------------------------------'
)
Assert-AreEqual $expected $actual
