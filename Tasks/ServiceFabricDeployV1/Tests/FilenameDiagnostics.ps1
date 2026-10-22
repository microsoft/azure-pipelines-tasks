[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\utilities.ps1
Register-Mock Find-VstsFiles { $filePath }
Register-Mock Assert-VstsPath
Register-Mock Write-Host { $script:messages += $args[0] }

foreach ($filePath in @('C:\package\ordinary app', 'C:\package\##vso[test]\##[test]\app'))
{
    $script:messages = @()

    $actual = Get-SinglePathOfType -Pattern 'package\*' -PathType Container -Require
    Assert-AreEqual $filePath $actual 'The original path must be returned.'
    Assert-WasCalled Assert-VstsPath -- -LiteralPath $filePath -PathType Container
    $display = $filePath.Replace('##vso[', '##_vso[').Replace('##[', '##_[')
    Assert-AreEqual $true ($script:messages -contains "FoundPath $display") 'The actual FoundPath diagnostic must be safe.'
    Assert-AreEqual $true ($script:messages -contains 'SearchingForPath package\*') 'Ordinary diagnostics must be unchanged.'
}
