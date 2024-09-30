[CmdletBinding()]
param()

. $PSScriptRoot\..\lib\Initialize-Test.ps1

$featureName = "TestFeature"
$featureVariable = "DISTRIBUTEDTASK_TASKS_TESTFEATURE"

Invoke-VstsTaskScript -ScriptBlock {
    $testInputs = @(
        @("true", $true),
        @("TRUE", $true),
        @("TruE", $true),
        @("false", $false),
        @("treu", $false),
        @("fasle", $false),
        @("On", $false),
        @("", $false),
        @($null, $false)
    )
    foreach ($testInput in $testInputs) {
        $inputValue = $testInput[0]
        $expectedValue = $testInput[1]

        Set-Item -Path env:$featureVariable -Value $inputValue

        $result = Get-VstsPipelineFeature -FeatureName $featureName

        try {
            Assert-AreEqual -Expected $expectedValue -Actual $result -Message "Suite failed. Input value: '$inputValue'"
        }
        finally {
            ${env:$featureVariable} = ""
        }
    }
}
