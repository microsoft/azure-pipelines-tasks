[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\utilities.ps1
Register-Mock Find-VstsFiles { $filePath }
Register-Mock Assert-VstsPath
Register-Mock Write-Host { $script:messages += $args[0] }
Register-Mock Get-VstsPipelineFeature {
    Assert-AreEqual 'EnableVsoCommandBlockingRMTasks' $args[1]
    $featureValue -eq 'true'
}

foreach ($featureValue in @($null, 'false', 'true'))
{
foreach ($filePath in @('C:\package\ordinary app', 'C:\package\##vso[task.debug]value\##[test]\app'))
{
    $script:messages = @()

    $actual = Get-SinglePathOfType -Pattern 'package\*' -PathType Container -Require
    Assert-AreEqual $filePath $actual 'The original path must be returned.'
    Assert-WasCalled Assert-VstsPath -- -LiteralPath $filePath -PathType Container
    $display = if ($featureValue -eq 'true') { $filePath.Replace('##vso[', '##_vso[').Replace('##[', '##_[') } else { $filePath }
    Assert-AreEqual $true ($script:messages -contains "FoundPath $display") 'The actual FoundPath diagnostic must be safe.'
    Assert-AreEqual $true ($script:messages -contains 'SearchingForPath package\*') 'Ordinary diagnostics must be unchanged.'
    $events = @($script:messages | Where-Object { $_ -like '##vso[[]telemetry.publish *' })
    Assert-AreEqual ([int]$filePath.Contains('##vso[')) $events.Count
    foreach ($event in $events) {
        Assert-AreEqual $true ($event.Contains('"source":"repository"'))
        Assert-AreEqual $true ($event.Contains('"blocked":' + "$($featureValue -eq 'true')".ToLowerInvariant()))
    }
}
}
