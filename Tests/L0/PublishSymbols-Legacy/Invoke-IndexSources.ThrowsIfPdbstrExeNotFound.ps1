[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
Register-Mock Get-ToolPath

# Act/Assert.
Assert-Throws {
        Invoke-IndexSources -SymbolsFilePaths 'Some assembly.pdb' -TreatNotIndexedAsWarning:$false
    } -MessagePattern 'Could not find pdbstr.exe'

# Assert.
Assert-WasCalled Get-ToolPath -- -Name 'Pdbstr\pdbstr.exe'

