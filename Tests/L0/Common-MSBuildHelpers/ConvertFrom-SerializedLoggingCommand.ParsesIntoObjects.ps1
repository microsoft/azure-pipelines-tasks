[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers
$module = Get-Module MSBuildHelpers
$variableSets = @(
    @{
        Message = '##vso[SomeArea.SomeEvent]SomeData'
        Expected = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Properties = @{ }
            Data = 'SomeData'
        }
    }
    @{
        Message = '##vso[SomeArea.SomeEvent SomePropertyName1=Some property value;SomePropertyName2=Some property value with %3B, %0D, and %0A.]Some data with %3B, %0D, and %0A.'
        Expected = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Properties = @{
                SomePropertyName1 = 'Some property value'
                SomePropertyName2 = "Some property value with ;, `r, and `n."
            }
            Data = "Some data with ;, `r, and `n."
        }
    }
    @{
        Message = "##[foo;=`r`n] ##vso[SomeArea.SomeEvent]SomeData"
        Expected = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Properties = @{ }
            Data = 'SomeData'
        }
    }
)
foreach ($variableSet in $variableSets) {
    # Act.
    $actual = & $module ConvertFrom-SerializedLoggingCommand -Message $variableSet.Message

    # Assert.
    $expected = $variableSet.Expected
    Assert-AreEqual $expected.Area $actual.Area
    Assert-AreEqual $expected.Event $actual.Event
    Assert-AreEqual $expected.Data $actual.Data
    $expectedKeys = ($expected.Properties.Keys | Sort-Object)
    $actualKeys = ($actual.Properties.Keys | Sort-Object)
    Assert-AreEqual $expectedKeys $actualKeys
    if ($expected.Properties.Count) {
        $expectedValues = ($expected.Properties.Keys | Sort-Object | ForEach-Object { $expected.Properties[$_] })
        $actualValues = ($actual.Properties.Keys | Sort-Object | ForEach-Object { $actual.Properties[$_] })
        Assert-AreEqual $expectedValues $actualValues
    }
}
