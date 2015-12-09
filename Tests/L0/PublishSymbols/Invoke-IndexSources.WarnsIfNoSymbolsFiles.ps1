[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\Helpers.ps1
Register-Mock Write-Warning

# Act.
Invoke-IndexSources -SymbolsFilePaths @() -TreatNotIndexedAsWarning:$false

# Assert.
Assert-WasCalled Write-Warning -Times 1
Assert-WasCalled Write-Warning -- 'No files were selected for indexing.'

