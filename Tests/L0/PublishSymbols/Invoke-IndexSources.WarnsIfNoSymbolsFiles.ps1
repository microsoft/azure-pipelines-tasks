[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\IndexFunctions.ps1
Register-Mock Write-Warning

# Act.
Invoke-IndexSources -SymbolsFilePaths @() -TreatNotIndexedAsWarning:$false

# Assert.
Assert-WasCalled Write-Warning -Times 1
Assert-WasCalled Write-Warning -- 'NoFilesForIndexing'
