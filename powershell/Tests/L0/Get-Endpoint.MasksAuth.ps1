[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$env:ENDPOINT_URL_SOMENAME = 'Some URL'
$env:ENDPOINT_AUTH_SOMENAME = '{ ''SomeProperty'' : ''Some property value'', ''SomeProperty2'' : ''Some property value 2'' }'
$env:ENDPOINT_DATA_SOMENAME = '{ ''SomeDataProperty'' : ''Some data property value'' }'
Invoke-VstsTaskScript -ScriptBlock {
    # Act.
    $actual = Get-VstsEndpoint -Name 'SomeName' 4>&1

    # Assert.
    Assert-IsNotNullOrEmpty $actual
    Assert-AreEqual 4 $actual.Length
    $verboseAuthRecord =
        $actual.Where{
            $_ -is [System.Management.Automation.VerboseRecord] -and
            $_.Message -like '*AUTH*'
        }
    Assert-IsNotNullOrEmpty $verboseAuthRecord
    Assert-AreEqual "ENDPOINT_AUTH_SomeName: '********'" $verboseAuthRecord.Message
}