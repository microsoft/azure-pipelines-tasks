[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

# Arrange 
$distributedTaskContext = 'Some distributed task context'

function VerifyPrRun
{
    param([string]$SQPullRequestBotSetting, [bool]$IsPrBuild, [bool]$ExpectedToRun )

    # Arrange
    if ($SQPullRequestBotSetting -ne $null)
    {
        Register-Mock Get-TaskVariable { $SQPullRequestBotSetting } -- -Context $distributedTaskContext -Name 'SQPullRequestBot'
    }
    
    Register-Mock IsPrBuild {$IsPrBuild}
    Register-Mock Write-Host
    Register-Mock InvokePreBuildTask
    
    #Act
    . $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\SonarQubePreBuild.ps1 -connectedServiceName "service" -projectKey "projectKey" -projectName "projectName" -projectVersion "1"
    
    # Assert
    if ($ExpectedToRun)
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
    
    if ($SQPullRequestBotSetting -ne $null)
    {
        Unregister-Mock Get-TaskVariable
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
 







