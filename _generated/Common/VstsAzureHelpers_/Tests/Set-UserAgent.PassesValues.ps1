[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$variableSets = @(
    @{
        UserAgent = 'tfs_build'
    }
    @{
        UserAgent = ''
    }
)

foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Get-VstsTaskVariable
    Unregister-Mock Set-UserAgent_Core
    Register-Mock Get-VstsTaskVariable { $variableSet.UserAgent } -- -Name AZURE_HTTP_USER_AGENT    
    Register-Mock Set-UserAgent_Core

    # Act.  
    & $module Set-UserAgent
    
    # Assert.
    if ($variableSet.UserAgent) {
        Assert-WasCalled Set-UserAgent_Core -- -UserAgent 'tfs_build'
    } else {
        Assert-WasCalled Set-UserAgent_Core -Times 0
    }
}