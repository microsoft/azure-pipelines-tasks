[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru

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