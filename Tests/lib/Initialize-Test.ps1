[cmdletbinding()]
param()

Write-Verbose "Initializing test helpers."
$PSModuleAutoloadingPreference = 'None'
if (!(Get-Module | Where-Object { $_.Name -eq 'Microsoft.PowerShell.Management' })) {
    Write-Verbose "Importing module: Microsoft.PowerShell.Management"
    Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false
}

Import-Module $PSScriptRoot\TestHelpersModule -Verbose:$false
Register-Mock Import-Module
function Get-LocalizedString {
    [cmdletbinding()]
    param(
        [parameter(Mandatory = $true)]
        [string]$Key,
        
        [object[]]$ArgumentList)

    if (@($ArgumentList).Count -eq 0) { # Workaround for Powershell quirk, passing a single null argument to a list parameter.
        $ArgumentList = @( $null )
    }

    ($Key -f $ArgumentList)
}