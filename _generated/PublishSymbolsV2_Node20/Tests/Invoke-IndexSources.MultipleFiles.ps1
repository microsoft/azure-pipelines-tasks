[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\IndexFunctions.ps1
foreach ($treatNotIndexedAsWarning in @($false, $true)) {
    Unregister-Mock Push-Location
    Unregister-Mock Add-DbghelpLibrary
    Unregister-Mock Get-PdbstrPath
    Unregister-Mock Get-SourceProvider
    Unregister-Mock Get-SourceFilePaths
    Unregister-Mock New-SrcSrvIniContent
    Unregister-Mock Add-SourceServerStream
    Unregister-Mock Remove-DbghelpLibrary
    $pdbstrExePath = "SomeDrive:\AgentHome\...\pdbstr.exe"
    Register-Mock Get-PdbstrPath { $pdbstrExePath }
    Register-Mock Push-Location
    $script:libraryHandle = -1234
    Register-Mock Add-DbghelpLibrary { $script:libraryHandle }
    $script:sourcesRoot = 'SomeDrive:\SomeSourcesRoot'
    $script:provider = New-Object psobject -Property @{ SourcesRootPath = $sourcesRoot }
    Register-Mock Get-SourceProvider { $script:provider }
    Register-Mock Add-SourceServerStream
    Register-Mock Remove-DbghelpLibrary

    # Arrange mocks for the first symbols file.
    $symbolsFile1 = 'SomeDrive:\SomeDir\SomeLibrary1.pdb'
    $sourceFile1 = "$sourcesRoot\SourceFile1.cs"
    $sourceFile2 = "$sourcesRoot\SourceFile2.cs"
    Register-Mock Get-SourceFilePaths {
            $sourceFile1
            $sourceFile2
        } -- -SymbolsFilePath $symbolsFile1 -SourcesRootPath $sourcesRoot -TreatNotIndexedAsWarning: $treatNotIndexedAsWarning
    $iniContent1 = 'Some INI content 1'
    Register-Mock New-SrcSrvIniContent { $iniContent1 } -- -Provider $provider -SourceFilePaths $sourceFile1, $sourceFile2

    # Arrange mocks for the second symbols file.
    $symbolsFile2 = 'SomeDrive:\SomeDir\SomeLibrary2.pdb'
    $sourceFile3 = "$sourcesRoot\SourceFile3.cs"
    $sourceFile4 = "$sourcesRoot\SourceFile4.cs"
    Register-Mock Get-SourceFilePaths {
            $sourceFile3
            $sourceFile4
        } -- -SymbolsFilePath $symbolsFile2 -SourcesRootPath $sourcesRoot -TreatNotIndexedAsWarning: $treatNotIndexedAsWarning
    $iniContent2 = 'Some INI content 2'
    Register-Mock New-SrcSrvIniContent { $iniContent2 } -- -Provider $provider -SourceFilePaths $sourceFile3, $sourceFile4

    # Act.
    Invoke-IndexSources -SymbolsFilePaths $symbolsFile1, $symbolsFile2 -TreatNotIndexedAsWarning:$treatNotIndexedAsWarning

    # Assert.
    Assert-WasCalled Push-Location $env:TEMP
    Assert-WasCalled Add-SourceServerStream -- -PdbStrPath $pdbstrExePath -SymbolsFilePath $symbolsFile1 -StreamContent $iniContent1
    Assert-WasCalled Add-SourceServerStream -- -PdbStrPath $pdbstrExePath -SymbolsFilePath $symbolsFile2 -StreamContent $iniContent2
    Assert-WasCalled Remove-DbghelpLibrary -- -HModule $libraryHandle
}
