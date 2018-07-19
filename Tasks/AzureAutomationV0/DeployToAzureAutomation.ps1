param (
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$ResourceGroupName,
    [string][Parameter(Mandatory=$true)]$AutomationAccountName,
    [string][Parameter(Mandatory=$false)]$AutomationRunbook = $null,
    [string][Parameter(Mandatory=$false)]$RunbookFile = $null,
    [string][Parameter(Mandatory=$false)]$StartRunbookJob,
    [string][Parameter(Mandatory=$false)]$RunbookParametersFile = $null,
    [string][Parameter(Mandatory=$false)]$HybridWorker = $null,
    [string][Parameter(Mandatory=$false)]$AutomationDscConfiguration = $null,
    [string][Parameter(Mandatory=$false)]$DscConfigurationFile = $null,
    [string][Parameter(Mandatory=$False)]$DscStorageAccountName,
    [string][Parameter(Mandatory=$false)]$CompileDscConfiguration,
    [string][Parameter(Mandatory=$false)]$DscParametersFile = $null,
    [string][Parameter(Mandatory=$false)]$DscConfigurationDataFile = $null,
    [string][Parameter(Mandatory=$false)]$DscNodes,
    [string][Parameter(Mandatory=$false)]$ModulesFile = $null,
    [string][Parameter(Mandatory=$false)]$ModuleStorageAccountName
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# If the user wants to deploy runbooks to Azure Automation
if ($AutomationRunbook -or ($RunbookFile -and (($RunbookFile.Split('.')[-1] -match "ps1") -or ($RunbookFile.Split('.')[-1] -match "py")))) {
    if ($AutomationRunbook -and (-not($RunbookFile) -or (-not($RunbookFile.Split('.')[-1] -match "ps1") -or (-not($RunbookFile.Split('.')[-1] -match "py"))))) {
        Write-Host "We are in the runbook if if "
        if ($StartRunbookJob) {
            & ".\StartAzureAutomationRunbook.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
            -AutomationAccountName $AutomationAccountName -RunbookName $AutomationRunbook -RunbookParametersFile $RunbookParametersFile -RunOn $HybridWorker
        }
    }

    elseif ($RunbookFile -and (-not($AutomationRunbook))) {
        & ".\ImportAzureAutomationRunbook.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
        -AutomationAccountName $AutomationAccountName -RunbookPath $RunbookFile
        if ($StartRunbookJob) {
            $RunbookName = Get-ChildItem -Path $RunbookFile -File -Include ('*.ps1', '*.py') -Recurse -Depth 1
            & ".\StartAzureAutomationRunbook.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
            -AutomationAccountName $AutomationAccountName -RunbookName $RunbookName.BaseName -RunbookParametersFile $RunbookParametersFile -RunOn $HybridWorker
        }
    }
}

# If the user wants to deploy DSC configurations to Azure Automation
if ($AutomationDscConfiguration -or ($DscConfigurationFile -and ($DscConfigurationFile.Split('.')[-1] -match "ps1"))) {
    if ($AutomationDscConfiguration -and (-not($DscConfigurationFile) -or (-not($DscConfigurationFile.Split('.')[-1] -match "ps1")))) {
        if ($CompileDscConfiguration) {
            & ".\DeployAzureAutomationDscConfiguration.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
            -AutomationAccountName $AutomationAccountName -AADscConfiguration $AutomationDscConfiguration -ParametersFile $DscParametersFile `
            -ConfigurationDataFile $DscConfigurationDataFile -DscNodeNames $DscNodes
        }
    }

    elseif ($DscConfigurationFile -and (-not($AutomationDscConfiguration))) {
        if ($DscStorageAccountName) {
            & ".\ImportAzureAutomationDscConfiguration.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
            -AutomationAccountName $AutomationAccountName -DscConfigurationPath $DscConfigurationFile -StorageAccountName $DscStorageAccountName
        }
        else {
            & ".\ImportAzureAutomationDscConfiguration.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
            -AutomationAccountName $AutomationAccountName -DscConfigurationPath $DscConfigurationFile
        }
        if ($CompileDscConfiguration) {
            & ".\DeployAzureAutomationDscConfiguration.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
            -AutomationAccountName $AutomationAccountName -DscConfigurationFile $DscConfigurationFile -ParametersFile $DscParametersFile `
            -ConfigurationDataFile $DscConfigurationDataFile -DscNodeNames $DscNodes
        }
    }
}

# If the user wants to deploy modules to Azure Automation
if (($ModulesFile -ne $null) -and ($ModulesFile -ne "D:\a\r1\a")) {
    & ".\ImportAzureAutomationModules.ps1" -ConnectedServiceName $ConnectedServiceName -ResourceGroupName $ResourceGroupName `
    -AutomationAccountName $AutomationAccountName -ModulePath $ModulesFile -StorageAccountName $ModuleStorageAccountName
}

