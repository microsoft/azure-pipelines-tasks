param (
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$ResourceGroupName,
    [string][Parameter(Mandatory=$true)]$AutomationAccountName,
    [string][Parameter(Mandatory=$False)]$RunbookName = $null,
    [string][Parameter(Mandatory=$False)]$RunbookFile = $null,
    [string][Parameter(Mandatory=$False)]$RunOn = $null,
    [string][Parameter(Mandatory=$False)]$RunbookParametersFile = $null
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Get runbook parameters from parameters file or editor text box
$Parameters = @{}
if ($RunbookParametersFile.Split('.')[-1] -match "json")
{
    $ParametersFile = @{}
    # Read json file passed in for the parameters
    $RunbookParameters = Get-Content -Path $RunbookParametersFile -Raw

    # Create a hash table from the json values passed in
    (ConvertFrom-Json $RunbookParameters).psobject.properties | ForEach-Object { $ParametersFile[$_.Name] = $_.Value }

    # Add in the parameters to the list if they don't already exist.
    foreach ($Param in $ParametersFile.Keys)
    {
        if ($Parameters[$Param] -eq $null)
        {
            $Parameters.Add($Param, $ParametersFile[$Param])
        }
    }
}

# Start the runbook checking if parameters are provided and hybrid worker is specified
if ($Parameters.Count -gt 0)
{
    if ($RunOn -eq $null -or $RunOn -eq "Azure")
    {
        $RunbookJob = Start-AzureRMAutomationRunbook -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                                        -Name $RunbookName -Parameters $Parameters -Wait
    }
    else
    {
        $RunbookJob = Start-AzureRMAutomationRunbook -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                                        -Name $RunbookName -Parameters $Parameters -RunOn $RunOn -Wait
    }
}

else
{
    if ($RunOn -eq $null -or $RunOn -eq "Azure")
    {
        $RunbookJob = Start-AzureRMAutomationRunbook -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                                        -Name $RunbookName -Wait
    }
    else
    {
        $RunbookJob = Start-AzureRMAutomationRunbook -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                                        -Name $RunbookName -RunOn $RunOn -Wait
    }
}

Write-Host "Runbook job has been successfully started in Automation Account"