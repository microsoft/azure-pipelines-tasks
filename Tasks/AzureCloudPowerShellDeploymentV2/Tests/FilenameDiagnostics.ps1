[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Get-VstsInput {
    if ($args[1] -eq 'CsCfg') { 'config-pattern' }
    elseif ($args[1] -eq 'CsPkg') { 'package-pattern' }
    elseif ($args[1] -eq 'DiagnosticStorageAccountKeys') { '' }
    elseif ($args -contains '-AsBool') { $false }
    else { 'test' }
}
Register-Mock Get-VstsEndpoint { @{ auth = @{ parameters = @{ AccessToken = 'test' } } } }
Register-Mock ConvertTo-SecureString
Register-Mock Initialize-AzModule
Register-Mock Remove-EndpointSecrets
Register-Mock Test-Path { $false }
Register-Mock Get-AzCloudService { throw 'End of filename test' }
Register-Mock Write-Host { $script:messages += $args[0] }
Register-Mock Find-VstsFiles {
    if ($args[1] -eq 'config-pattern') { $configFiles } else { $packageFiles }
}

foreach ($name in @('ordinary file', '##vso[test]##[test]'))
{
    foreach ($multiple in @('none', 'config', 'package'))
    {
        $configFiles = "C:\package\$name.cscfg"
        $packageFiles = "C:\package\$name.cspkg"
        if ($multiple -eq 'config') { $configFiles = @($configFiles, 'C:\package\second.cscfg') }
        if ($multiple -eq 'package') { $packageFiles = @($packageFiles, 'C:\package\second.cspkg') }
        $script:messages = @()
        try {
            . $PSScriptRoot\..\Publish-AzureCloudDeployment.ps1
            throw 'Expected task to stop at the mocked service API or multiple-file validation.'
        } catch {
            $expected = if ($multiple -eq 'none') { 'End of filename test' }
                else { 'Foundmorethanonefiletodeploywithsearchpattern0Therecanbeonlyone' }
            Assert-AreEqual $true ($_.Exception.Message.StartsWith($expected)) "Unexpected task failure: $_"
        }
        $configDisplay = "$configFiles".Replace('##vso[', '##_vso[').Replace('##[', '##_[')
        Assert-AreEqual $true ($script:messages -contains "serviceConfigFile= $configDisplay") 'Config diagnostic must be safe.'
        Assert-AreEqual "$configFiles" "$serviceConfigFile" 'Config selection must retain original paths.'
        Assert-AreEqual ($configFiles -is [array]) ($serviceConfigFile -is [array]) 'Config selection must retain its shape.'
        if ($multiple -ne 'config') {
            $packageDisplay = "$packageFiles".Replace('##vso[', '##_vso[').Replace('##[', '##_[')
            Assert-AreEqual $true ($script:messages -contains "servicePackageFile= $packageDisplay") 'Package diagnostic must be safe.'
            Assert-AreEqual "$packageFiles" "$servicePackageFile" 'Package selection must retain original paths.'
            Assert-AreEqual ($packageFiles -is [array]) ($servicePackageFile -is [array]) 'Package selection must retain its shape.'
        }
        Assert-AreEqual $true ($script:messages -contains 'Finding config-pattern') 'Ordinary diagnostic must be unchanged.'
    }
}
