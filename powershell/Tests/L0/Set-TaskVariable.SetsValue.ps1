[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Path = 'Env:Some_name' ; Name = 'Some.name' ; Expected = 'Some public value' ; IsSecret = $false }
        @{ Path = 'Env:Some_name' ; Name = 'Some.name' ; Expected = 'Some secret value' ; IsSecret = $true }
        @{ Path = 'Env:agent.jobstatus' ; Name = 'agent.jobstatus' ; Expected = 'Some job status' ; IsSecret = $false }
    )
    foreach ($variableSet in $variableSets) {
        Unregister-Mock Write-SetVariable
        Register-Mock Write-SetVariable
        Set-Content -LiteralPath $variableSet.Path -Value ''

        # Act.
        Set-VstsTaskVariable -Name $variableSet.Name -Value $variableSet.Expected -Secret:$variableSet.IsSecret

        # Assert the correct value is retrieved.
        $actual = Get-VstsTaskVariable -Name $variableSet.Name
        Assert-AreEqual $variableSet.Expected $actual

        # Assert the env variable is set for public variables, and not for secret variables.
        $actualEnvValue = Get-Content -LiteralPath $variableSet.Path -ErrorAction Ignore
        if ($variableSet.IsSecret) {
            Assert-AreEqual '' $actualEnvValue
        } else {
            Assert-AreEqual $variableSet.Expected $actualEnvValue
        }

        # Assert the ##command was written.
        Assert-WasCalled Write-SetVariable -- -Name $variableSet.Name -Value $variableSet.Expected -Secret: $variableSet.IsSecret
    }
}