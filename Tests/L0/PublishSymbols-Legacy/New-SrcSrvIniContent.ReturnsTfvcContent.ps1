[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$provider = New-Object psobject -Property @{ Name = 'TfsVersionControl' }
$sourceFiles = 'SomeDrive:\SomeDir\SomeFile1.cs', 'SomeDrive:\SomeDir\SomeFile2.cs'
Register-Mock New-TfvcSrcSrvIniContent { 'Some content 1', 'Some content 2' } -- -Provider $provider -SourceFilePaths $sourceFiles

# Act.
$actual = New-SrcSrvIniContent -Provider $provider -SourceFilePaths $sourceFiles

# Assert.
Assert-AreEqual "Some content 1`r`nSome content 2`r`n" $actual
