
. $PSScriptRoot/ParameterParser.ps1

function Get-LoadTestXML($loadTestPath) {
    return [xml]$loadTestdXML = (Get-Content $loadTestPath)
}
function Set-ActiveRunSetting($loadTestPath, $runSettingName) {
    $loadTestdXML = Get-LoadTestXML $loadTestPath

    "Current run setting [" + $loadTestdXML.LoadTest.CurrentRunConfig + "] for $loadTestPath" | Write-Output

    # We only change the setting if it's a different one
    if ($loadTestdXML.LoadTest.CurrentRunConfig -cne $runSettingName) {
        # Check if run setting exists
        if (($loadTestdXML.LoadTest.RunConfigurations.ChildNodes | Where-Object { $_.Name -ceq $runSettingName}) -eq $null) {
            ErrorMessage "Could not find run setting $runSettingName (case sensitive)"
        }      

        Write-Output "Setting active run setting to $runSettingName"

        $loadTestdXML.LoadTest.SetAttribute("CurrentRunConfig", $runSettingName)

        $loadTestdXML.Save($loadTestPath)
    }
}

# Set context parameters for active run setting
function Set-ContextParameters($loadTestPath, $contextParameters) {
    $loadTestdXML = Get-LoadTestXML $loadTestPath

    if ($contextParameters.Count -eq 0) {
        Write-Debug "No override parameters. Skipping"
        return
    }

    "Setting parameters for run setting [" + $loadTestdXML.LoadTest.CurrentRunConfig +"]" | Write-Output
    "Trying to override " + $contextParameters.Count + " context parameters" | Write-Output

    $runConfigurationNode = $loadTestdXML.LoadTest.RunConfigurations.ChildNodes | Where-Object { $_.Name -ceq $loadTestdXML.LoadTest.CurrentRunConfig}

    if ($runConfigurationNode.ContextParameters -eq $null -or $runConfigurationNode.ContextParameters.ChildNodes.Count -eq 0) {
        Write-Warning "No context parameters defined in test. Nothing to override"
    }
    else {
        Foreach ($name in $contextParameters.Keys) {
            $parameterNode = $runConfigurationNode.ContextParameters.ChildNodes | Where-Object { $_.Name -ceq $name }

            if ($parameterNode -eq $null) {
                Write-Warning "Passed context parameter `[$name`] is not defined on load test. It will not be overriden. Parameter name is case sensitive"
            }
            else {
                Write-Output "Value set for parameter $name"
                $parameterNode.SetAttribute("Value", $contextParameters[$name])
            }
        }
        $loadTestdXML.Save($loadTestPath)
    }
}
function Set-RunSettings($LoadTest, $activeRunSettings, $runSettingName, $testContextParameters) {

    Write-Debug "setting run settings with action $activeRunSettings"
    
    if ($activeRunSettings -ieq "changeActive") {
        Set-ActiveRunSetting $LoadTest $runSettingName 
    }
    elseif ($activeRunSettings -ieq "useFile") {
        $testParameters = Convert-StringParameters $testContextParameters -removeQuotes
        Set-ContextParameters $LoadTest $testParameters
    }
    else {
        ErrorMessage "Unknown option $activeRunSettings for active run settings"
    }
}

function ErrorMessage($message) {
    Write-Error $message
    exit $LastExitCode
}

function ValidateRunSettingsInputs($loadTestPath, $activeRunSettings, $runSettingName) {

    Write-Debug "Validating run settings for $loadTestPath"

    if ($activeRunSettings -notin "changeActive", "useFile") {
        ErrorMessage "Unknown parameter $activeRunSettings"
    }

    $loadTestFileName = Split-Path $loadTestPath -Leaf

    # Validate if load
    if ($activeRunSettings -ieq "changeActive") {

        if ($runSettingName -eq "") {
            ErrorMessage "run setting name cannot be empty"
        }

        $loadTestdXML = Get-LoadTestXML $loadTestPath

        Write-Debug "Checking if $runSettingName exists in $loadTestFileName"

        if (($loadTestdXML.LoadTest.RunConfigurations.ChildNodes | Where-Object { $_.Name -ceq $runSettingName}) -eq $null) {
            ErrorMessage "run setting $runSettingName does not exist in $loadTestFileName (name is case sensitive)"
        }
    }
}
