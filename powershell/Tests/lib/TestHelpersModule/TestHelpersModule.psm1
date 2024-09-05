[CmdletBinding()]
param()

[hashtable]$script:mocks = @{ }
. $PSScriptRoot\PrivateFunctions.ps1
. $PSScriptRoot\PublicFunctions.ps1

Export-ModuleMember -Verbose:$false -Function @(
    'Assert-AreEqual'
    'Assert-AreNotEqual'
    'Assert-TaskIssueMessagesAreEqual'
    'Assert-IsNotNullOrEmpty'
    'Assert-IsNullOrEmpty'
    'Assert-IsGreaterThan'
    'Assert-Throws'
    'Assert-WasCalled'
    'Register-Mock'
    'Unregister-Mock'
)
