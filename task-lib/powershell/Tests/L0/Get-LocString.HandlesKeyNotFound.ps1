[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    Register-Mock Write-Warning
    $variableSets = @(
        @{ Expected = 'NoSuchKey' ; Key = 'NoSuchKey' ; ArgumentList = @( ) }
        @{ Expected = 'NoSuchKey STR1 STR2' ; Key = 'NoSuchKey' ; ArgumentList = 'STR1', 'STR2' }
    )
    foreach ($variableSet in $variableSets) {
        Unregister-Mock Write-Warning
        Register-Mock Write-Warning

        # Act.
        $actual = Get-VstsLocString -Key $variableSet.Key -ArgumentList $variableSet.ArgumentList

        # Assert.
        Assert-AreEqual $variableSet.Expected $actual
        Assert-WasCalled Write-Warning -- "String resource key not found: '$($variableSet.Key)'"
    }
}