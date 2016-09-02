[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceProviderFunctions.ps1
Register-Mock Get-VstsTaskVariable { 'TfsGit' } -- -Name Build.Repository.Provider -Require
Register-Mock Get-VstsTaskVariable { 'Some build sources directory' } -- -Name Build.SourcesDirectory -Require
Register-Mock Get-VstsTaskVariable { 'Some team project ID' } -- -Name System.TeamProjectId -Require
Register-Mock Get-VstsTaskVariable { 'SomeProtocol://SomeCollection/' } -- -Name System.TeamFoundationCollectionUri -Require
Register-Mock Get-VstsTaskVariable { 'Some repo ID' } -- -Name Build.Repository.Id -Require
Register-Mock Get-VstsTaskVariable { 'Some commit ID' } -- -Name Build.SourceVersion -Require

# Act.
$actual = Get-SourceProvider

# Assert.
Assert-IsNotNullOrEmpty $actual
Assert-AreEqual 'TfsGit' $actual.Name
Assert-AreEqual 'Some build sources directory' $actual.SourcesRootPath
Assert-AreEqual 'Some team project ID' $actual.TeamProjectId
Assert-AreEqual 'SomeProtocol://SomeCollection' $actual.CollectionUrl
Assert-AreEqual 'Some repo ID' $actual.RepoId
Assert-AreEqual 'Some commit ID' $actual.CommitId
