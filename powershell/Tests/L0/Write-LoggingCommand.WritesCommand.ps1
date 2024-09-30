[CmdletBinding()]
param()

function global:Assert-HostMessage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Expected,
        [string]$AlternateExpected,
        [Parameter(Mandatory = $true)]
        [string[]]$HostMessages)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        foreach ($hostMessage in $HostMessages) {
            if ($hostMessage -eq $Expected -or ($AlternateExpected -and $hostMessage -eq $AlternateExpected)) {
                return
            }
        }

        throw "Matching host message not found."
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk
    $variableSets = @(
        @{
            Expected = '##vso[SomeArea.SomeEvent P1=V1;P2=V2]Some data'
            AlternateExpected = '##vso[SomeArea.SomeEvent P2=V2;P1=V1]Some data'
            Command = @{
                Area = 'SomeArea'
                Event = 'SomeEvent'
                Data = 'Some data'
                Properties = @{ P1 = 'V1' ; P2 = 'V2' }
            }
        }
        @{
            Expected = '##vso[SomeArea.SomeEvent P1=V1]Some data'
            Command = @{
                Area = 'SomeArea'
                Event = 'SomeEvent'
                Data = 'Some data'
                Properties = @{ P1 = 'V1' }
            }
        }
        @{
            Expected = '##vso[SomeArea.SomeEvent P1=Value with %3B, %0D, and %0A.]Some data with %3B, %0D, and %0A.'
            Command = @{
                Area = 'SomeArea'
                Event = 'SomeEvent'
                Data = "Some data with ;, `r, and `n."
                Properties = @{ P1 = "Value with ;, `r, and `n." }
            }
        }
        @{
            Expected = '##vso[SomeArea.SomeEvent]Some data'
            Command = @{
                Area = 'SomeArea'
                Event = 'SomeEvent'
                Data = 'Some data'
                Properties = @{ }
            }
        }
        @{
            Expected = '##vso[SomeArea.SomeEvent]Some data'
            Command = @{
                Area = 'SomeArea'
                Event = 'SomeEvent'
                Data = 'Some data'
            }
        }
        @{
            Expected = '##vso[SomeArea.SomeEvent]'
            Command = @{
                Area = 'SomeArea'
                Event = 'SomeEvent'
            }
        }
    )
    try {
        foreach ($variableSet in $variableSets) {
            $command = $variableSet.Command

            # Verify using as output switch.
            # Act.
            $actual = & $vstsModule Write-LoggingCommand @command -AsOutput
            # Assert.
            if (!$variableSet.AlternateExpected -or $variableSet.AlternateExpected -ne $actual) {
                Assert-AreEqual $variableSet.Expected $actual
            }

            # Verify using "Object" parameterset and as output switch.
            # Act.
            $actual = & $vstsModule Write-LoggingCommand -Command $command -AsOutput
            # Assert.
            if (!$variableSet.AlternateExpected -or $variableSet.AlternateExpected -ne $actual) {
                Assert-AreEqual $variableSet.Expected $actual
            }

            # Verify without using as output switch.
            # Arrange.
            # Override Write-Host for as short a time as possible. Otherwise the test output becomes confusing.
            $script:hostMessages = @( )
            Register-Mock Write-Host { $OFS = " " ; $script:hostMessages += "$args" }
            # Act.
            $actual = & $vstsModule Write-LoggingCommand @command
            Unregister-Mock Write-Host
            # Assert.
            Assert-AreEqual $null $actual
            Assert-HostMessage -Expected $variableSet.Expected -AlternateExpected $variableSet.AlternateExpected -HostMessages $hostMessages

            # Verify using "Object" parameterset and without using as output switch.
            # Arrange.
            # Override Write-Host for as short a time as possible. Otherwise the test output becomes confusing.
            $script:hostMessages = @( )
            Register-Mock Write-Host { $OFS = " " ; $script:hostMessages += "$args" }
            # Act.
            $actual = & $vstsModule Write-LoggingCommand -Command $command
            Unregister-Mock Write-Host
            # Assert.
            Assert-AreEqual $null $actual
            Assert-HostMessage -Expected $variableSet.Expected -AlternateExpected $variableSet.AlternateExpected -HostMessages $hostMessages
        }
    } catch {
        throw
    }
}