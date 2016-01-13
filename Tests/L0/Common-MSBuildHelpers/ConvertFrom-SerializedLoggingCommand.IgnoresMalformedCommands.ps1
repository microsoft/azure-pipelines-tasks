[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers
$module = Get-Module MSBuildHelpers
$messages = @(
    'No command'
    '##vso [SomeArea.SomeEvent]SomeData'
    '##vso[SomeArea.SomeEvent'
    '##vso[SomeAreaSomeEvent]SomeData'
    '##vso[]SomeData'
)
foreach ($message in $messages) {
    # Act.
    $actual = & $module ConvertFrom-SerializedLoggingCommand -Message $message

    # Assert.
    Assert-AreEqual $null $actual
}
