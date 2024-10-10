[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Path = 'Env:Some_name' ; Name = 'Some.name' ; Expected = 'Some value' }
        @{ Path = 'Env:agent.jobstatus' ; Name = 'agent.jobstatus' ; Expected = 'Some job status' }
    )
    foreach ($variableSet in $variableSets) {
        Set-Content -LiteralPath $variableSet.Path -Value $variableSet.Expected

        # Act.
        $actual = Get-VstsTaskVariable -Name $variableSet.Name

        # Assert.
        Assert-AreEqual $variableSet.Expected $actual
    }
}