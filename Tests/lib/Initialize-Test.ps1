[cmdletbinding()]
param()

Write-Verbose "Initializing test helpers."
$PSModuleAutoloadingPreference = 'None'
if (!(Get-Module | Where-Object { $_.Name -eq 'Microsoft.PowerShell.Management' })) {
    Write-Verbose "Importing module: Microsoft.PowerShell.Management"
    Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false
}

Import-Module $PSScriptRoot\TestHelpersModule -Verbose:$false

# Stub common commands.
Register-Stub -Command Import-Module
