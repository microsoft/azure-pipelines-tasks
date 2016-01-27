[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
$variableSets = @(
    @{  Current = [timespan]::FromHours(1)
        Minimum = [timespan]::FromHours(10)
        Maximum = [timespan]::FromHours(20)
        Expected = [timespan]::FromHours(10) }
    @{  Current = [timespan]::FromHours(15)
        Minimum = [timespan]::FromHours(10)
        Maximum = [timespan]::FromHours(20)
        Expected = [timespan]::FromHours(15) }
    @{  Current = [timespan]::FromHours(30)
        Minimum = [timespan]::FromHours(10)
        Maximum = [timespan]::FromHours(20)
        Expected = [timespan]::FromHours(20) }
)
foreach ($variableSet in $variableSets) {
    $expected = $variableSet['Expected']
    $variableSet.Remove('Expected')

    # Act.
    $actual = Get-ValidValue @variableSet

    # Assert.
    Assert-AreEqual $expected $actual
}
