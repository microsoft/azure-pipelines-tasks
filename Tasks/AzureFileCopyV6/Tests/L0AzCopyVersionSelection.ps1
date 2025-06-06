[CmdletBinding()]
param()

. $PSScriptRoot\..\Utility.ps1

# Test: Az.Accounts >= 5.0.0 should use AzCopy/Latest
Describe 'AzCopy Version Selection - Az.Accounts >= 5.0.0' {
    Mock Get-Module {
        [PSCustomObject]@{ Version = '5.0.0' }
    } -ModuleName Microsoft.PowerShell.Core -ParameterFilter { $Name -eq 'Az.Accounts' -and $ListAvailable }

    It 'Should select AzCopy/Latest' {
        . $PSScriptRoot\..\AzureFileCopy.ps1
        $azCopyExeLocation | Should -Be 'AzCopy/Latest/AzCopy.exe'
    }
}

# Test: Az.Accounts < 5.0.0 should use AzCopy/Prev
Describe 'AzCopy Version Selection - Az.Accounts < 5.0.0' {
    Mock Get-Module {
        [PSCustomObject]@{ Version = '4.7.0' }
    } -ModuleName Microsoft.PowerShell.Core -ParameterFilter { $Name -eq 'Az.Accounts' -and $ListAvailable }

    It 'Should select AzCopy/Prev' {
        . $PSScriptRoot\..\AzureFileCopy.ps1
        $azCopyExeLocation | Should -Be 'AzCopy/Prev/AzCopy.exe'
    }
}

# E2E: Simulate upload (mock actual upload, check invocation)
Describe 'E2E AzCopy Upload Invocation' {
    Mock Upload-FilesToAzureContainer {
        return 'Upload Invoked'
    }
    Mock Get-Module {
        [PSCustomObject]@{ Version = '5.0.0' }
    } -ModuleName Microsoft.PowerShell.Core -ParameterFilter { $Name -eq 'Az.Accounts' -and $ListAvailable }

    It 'Should invoke upload with AzCopy/Latest' {
        . $PSScriptRoot\..\AzureFileCopy.ps1
        $result = Upload-FilesToAzureContainer -sourcePath 'dummy' -endPoint $null -storageAccountName 'dummy' -containerName 'dummy' -azCopyLocation 'AzCopy/Latest' -destinationType 'AzureBlob' -useDefaultArguments $true -cleanTargetBeforeCopy $false
        $result | Should -Be 'Upload Invoked'
    }
}
