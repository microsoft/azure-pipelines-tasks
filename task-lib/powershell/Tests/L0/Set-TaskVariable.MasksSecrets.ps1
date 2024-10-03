[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Name = 'MyVar1' ; Value = 'MyValue1' ; IsSecret = $true ; Expected = "Set MyVar1 = '********'" }
        @{ Name = 'MyVar2' ; Value = 'MyValue2' ; IsSecret = $false ; Expected = "Set MyVar2 = 'MyValue2'" }
    )
    foreach ($variableSet in $variableSets) {
        # Act.
        $verboseMessage = Set-VstsTaskVariable -Name $variableSet.Name -Value $variableSet.Value -Secret:$variableSet.IsSecret -Verbose 4>&1 |
            Where-Object { $_ -is [System.Management.Automation.VerboseRecord] } |
            Select-Object -ExpandProperty Message

        # Assert.
        # Due to redirection limitation when running in PS4, more than one message may have been written
        # to the verbose stream when running in PS4 (write-host is redirected to verbose).
        Assert-AreEqual -Expected 1 -Actual ($verboseMessage | Where-Object { $_ -eq $variableSet.Expected }).Count -Message "Expected a verbose message '$($variableSet.Expected)'. Actual '$verboseMessage'"
    }
}