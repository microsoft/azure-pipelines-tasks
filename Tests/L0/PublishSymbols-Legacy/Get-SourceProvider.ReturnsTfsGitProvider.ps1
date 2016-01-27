[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$env:BUILD_REPOSITORY_PROVIDER = 'TfsGit'
$env:BUILD_SOURCESDIRECTORY = 'Some build sources directory'
$env:SYSTEM_TEAMPROJECTID = 'Some team project ID'
$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = 'SomeProtocol://SomeCollection/'
$env:BUILD_REPOSITORY_ID = 'Some repo ID'
$env:BUILD_SOURCEVERSION = 'Some commit ID'
Register-Mock Invoke-DisposeSourceProvider

# Act.
$actual = Get-SourceProvider

# Assert.
Assert-IsNotNullOrEmpty $actual
Assert-AreEqual $actual.Name $env:BUILD_REPOSITORY_PROVIDER
Assert-AreEqual $actual.SourcesRootPath $env:BUILD_SOURCESDIRECTORY
Assert-AreEqual $actual.TeamProjectId $env:SYSTEM_TEAMPROJECTID
Assert-AreEqual $actual.CollectionUrl "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI".TrimEnd('/')
Assert-AreEqual $actual.RepoId $env:BUILD_REPOSITORY_ID
Assert-AreEqual $actual.CommitId $env:BUILD_SOURCEVERSION
Assert-WasCalled Invoke-DisposeSourceProvider -Time 0
