[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\PublishFunctions.ps1
$variableSets = @(
    @{  ArtifactName = 'Some artifact name'
        LastTransactionId = 'Some last transaction ID'
        ExpectedRegex = 'Some artifact name' }
    @{  ArtifactName = 'Some artifact name'
        LastTransactionId = ''
        ExpectedRegex = 'Some artifact name' }
    @{  ArtifactName = ''
        LastTransactionId = 'Some last transaction ID'
        ExpectedRegex = 'Some last transaction ID' }
    @{  ArtifactName = ''
        LastTransactionId = ''
        ExpectedRegex = '[0-9a-f]+(-[0-9a-f]+){4}' } # GUID
)
foreach ($variableSet in $variableSets) {
    $expectedRegex = $variableSet['ExpectedRegex']
    $variableSet.Remove('ExpectedRegex')

    # Act.
    $actual = Get-ArtifactName @variableSet

    # Assert.
    Assert-AreEqual $true ($actual -match $expectedRegex)
}
