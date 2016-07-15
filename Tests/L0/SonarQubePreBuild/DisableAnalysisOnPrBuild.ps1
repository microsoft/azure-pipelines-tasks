[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

# Arrange 

function VerifyPrRun
{
    param([string]$sQPullRequestBotSetting, [bool]$isPrBuild, [bool]$expectedToRun )

    # Arrange
    if ($sQPullRequestBotSetting -ne $null)
    {
        Register-Mock GetTaskContextVariable { $sQPullRequestBotSetting } -- 'SQPullRequestBot'
    }
    
    Register-Mock IsPrBuild {$isPrBuild}
    Register-Mock Write-Host
    Register-Mock InvokePreBuildTask
    Register-Mock Get-VstsInput {$false} -- -Name "includeFullReport" -AsBool
    Register-Mock Get-VstsInput {$true} -- -Name "breakBuild" -AsBool
    Register-Mock Write-VstsTaskDebug
    
    #Act -connectedServiceName "service" -projectKey "projectKey" -projectName "projectName" -projectVersion "1"
    . $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\SonarQubePreBuild.ps1
    
    # Assert
    if ($expectedToRun)
    {
        Assert-WasCalled InvokePreBuildTask
    }
    else
    {
        Assert-WasCalled Write-Host -ArgumentsEvaluator {$args[0] -like "*SQPullRequestBot*"}
        Assert-WasCalled InvokePreBuildTask -Times 0
    }
    
    # Cleanup
    Unregister-Mock IsPrBuild 
    Unregister-Mock Write-Host
    Unregister-Mock InvokePreBuildTask
    Unregister-Mock Get-VstsInput 
    Unregister-Mock Write-VstsTaskDebug
    
    if ($sQPullRequestBotSetting -ne $null)
    {
        Unregister-Mock GetTaskContextVariable
    }
}

# PRCA is enabled by default but can be disabled through the build variable
VerifyPrRun -SQPullRequestBotSetting "true" -IsPrBuild $true -ExpectedToRun $true
VerifyPrRun -SQPullRequestBotSetting "false" -IsPrBuild $true -ExpectedToRun $false
VerifyPrRun -SQPullRequestBotSetting "something_else" -IsPrBuild $true -ExpectedToRun $true
VerifyPrRun -SQPullRequestBotSetting $null -IsPrBuild $true -ExpectedToRun $true

VerifyPrRun -SQPullRequestBotSetting "true" -IsPrBuild $false -ExpectedToRun $true
VerifyPrRun -SQPullRequestBotSetting "false" -IsPrBuild $false -ExpectedToRun $true
VerifyPrRun -SQPullRequestBotSetting "something_else" -IsPrBuild $false -ExpectedToRun $true
VerifyPrRun -SQPullRequestBotSetting $null -IsPrBuild $false -ExpectedToRun $true