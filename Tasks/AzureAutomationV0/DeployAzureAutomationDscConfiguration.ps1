param (
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$ResourceGroupName,
    [string][Parameter(Mandatory=$true)]$AutomationAccountName,
    [string][Parameter(Mandatory=$False)]$DscConfigurationFile = $null,
    [string][Parameter(Mandatory=$False)]$AADscConfiguration = $null,
    [string][Parameter(Mandatory=$False)]$ParametersFile = $null,
    [string][Parameter(Mandatory=$False)]$ConfigurationDataFile = $null,
    [string][Parameter(Mandatory=$False)]$DscNodeNames
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

$ConfigurationData = @{}
$ConfigurationParameters = @{}
$ConfigurationName = ""
$CompilationJob = ""

# Check if user provided a configuration that is already in the Automation Account
if ($AADscConfiguration)
{
    $ConfigurationName = $AADscConfiguration
}

# Check if the user provided a new configuration not already in Automation and needs to be imported first
elseif ($DscConfigurationFile -and (-not($AADscConfiguration))) 
{
    Import-AzureRmAutomationDscConfiguration -SourcePath $DscConfigurationFile -AutomationAccountName $AutomationAccountName `
                                    -ResourceGroupName $ResourceGroupName -Verbose -Published -Force 
    $ConfigurationName = [System.IO.Path]::GetFileNameWithoutExtension($DscConfigurationFile)   
}

# Get the required parameters for the configuration by checking if the parameters file is json
if ($ParametersFile.Split('.')[-1] -match "json") 
{
    $Parameters = Get-Content -Path $ParametersFile -Raw 
    (ConvertFrom-Json $Parameters).psobject.properties | ForEach-Object { $ConfigParams[$_.Name] = $_.Value } 
    foreach ($Param in $ConfigParams.Keys) 
    {
        if ($ConfigurationParameters[$Param] -eq $null) 
        {
            $ConfigurationParameters.Add($Param, $ConfigParams[$Param])
        }
    }
}

# Get the required parameters for the configuration by checking if the parameters file is psd1
elseif ($ParametersFile.Split('.')[-1] -match "psd1") 
{
    $ConfigurationParameters = Import-PowerShellDataFile -Path $ParametersFile
}

# Get the configuration data for the configuration
if ($ConfigurationDataFile.Split('.')[-1] -match "psd1") {
    $ConfigurationData = Import-PowerShellDataFile -Path $ConfigurationDataFile
}

# If the user provides a configuration that requires both parameters and configuration data 
if ($ParametersFile -and $ConfigurationDataFile) 
{ 
    $CompilationJob = Start-AzureRmAutomationDscCompilationJob -ConfigurationName $ConfigurationName -ConfigurationData $ConfigurationData `
    -Parameters $ConfigurationParameters -AutomationAccountName $AutomationAccountName -ResourceGroupName $ResourceGroupName
}

# If the user provides a configuration that only requires configuration data
elseif (-not($ParametersFile) -and $ConfigurationDataFile) 
{
    $CompilationJob = Start-AzureRmAutomationDscCompilationJob -ConfigurationName $ConfigurationName -ConfigurationData $ConfigurationData `
    -AutomationAccountName $AutomationAccountName -ResourceGroupName $ResourceGroupName
}

# If the user provides a configuration that requires only parameters
elseif ($ParametersFile -and -not($ConfigurationDataFile)) 
{
    $CompilationJob = Start-AzureRmAutomationDscCompilationJob -ConfigurationName $ConfigurationName -Parameters $ConfigurationParameters `
    -AutomationAccountName $AutomationAccountName -ResourceGroupName $ResourceGroupName
}

# If the user provides a simple configuration that doesn't require parameters or configuration data
else
{
    $CompilationJob = Start-AzureRmAutomationDscCompilationJob -ConfigurationName $ConfigurationName `
    -AutomationAccountName $AutomationAccountName -ResourceGroupName $ResourceGroupName
}

Write-Host "Configuration compilation job started"

# Wait to make sure the configuration compilation was successful 
$Timeout = 180
while (($CompilationJob.Status -ne "Completed") -and ($CompilationJob.Status -ne "Suspended") -and ($Timeout -gt 0))
{
     $CompilationJob = $CompilationJob | Get-AzureRmAutomationDscCompilationJob
     Start-Sleep -Seconds 5
     $Timeout = $Timeout - 5
} 

if ($CompilationJob.Status -ne "Completed") {
    Write-Host "Compilation suspended or failed to complete"
    exit -1
}

Write-Host "Configuration compilation job completed"

# Apply the DSC configuration if nodes are specified
if ($DscNodeNames)
{
    # If multiple node configurations were generated, get all of them
    $ConfigurationMetadata = Get-AzureRmAutomationDscNodeConfiguration -ResourceGroupName $ResourceGroupName `
    -AutomationAccountName $AutomationAccountName -ConfigurationName $ConfigurationName
    $CompiledMofs = @()

    foreach ($Metadata in $ConfigurationMetadata)
    {
        $CompiledMofs += ,($Metadata.Name)
    }

    foreach ($NodeName in $DscNodeNames)
    {
        $Id = [GUID](Get-AzureRmAutomationdscnode -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
             | Where {$_.Name -eq $NodeName} | Select Id | Format-Table -HideTableHeaders | out-string)

        # If node configurations with VM name extensions were generated, assign configurations to those VMs
        if ($CompiledMofs.Contains("$ConfigurationName.$NodeName"))
        {
            $DscConfigFilename = $ConfigurationName + "." + $NodeName
            Set-AzureRmAutomationDscNode -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                -NodeConfigurationName $DscConfigFilename -Id $Id -Force
        }

        # If node configurations were not generataed for specific VMs, assign localhost configurations
        elseif ($CompiledMofs.Contains("$ConfigurationName.localhost"))
        {
            $DscConfigFilename = $ConfigurationName + ".localhost"
            Set-AzureRmAutomationDscNode -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                -NodeConfigurationName $DscConfigFilename -Id $Id -Force
        }
        elseif ($CompiledMofs.Contains("$ConfigurationName.local"))
        {
            $DscConfigFilename = $ConfigurationName + ".local"
            Set-AzureRmAutomationDscNode -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                -NodeConfigurationName $DscConfigFilename -Id $Id -Force
        }

        Write-Host "Assigning node configuration $DscConfigFilename to $NodeName"
    }
}



