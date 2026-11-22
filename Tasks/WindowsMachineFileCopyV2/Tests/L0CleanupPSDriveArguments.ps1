[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

$testFunctionNames = @('net')
$previousTestFunctions = @{}
foreach($testFunctionName in $testFunctionNames)
{
    $previousTestFunction = Get-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
    if ($previousTestFunction)
    {
        $previousTestFunctions[$testFunctionName] = $previousTestFunction.ScriptBlock
    }
}
$global:netInvocations = New-Object System.Collections.Generic.List[object]

try
{
    function global:net {
        $global:netInvocations.Add(@($args))
    }

    $remoteSharePath = '\\m\C$\a&b %TEMP% ^c;d $(x) "e"'

    Try-CleanupPSDrive -Path $remoteSharePath

    Assert-AreEqual 1 $global:netInvocations.Count
    Assert-AreEqual 3 $global:netInvocations[0].Count
    Assert-AreEqual 'use' $global:netInvocations[0][0]
    Assert-AreEqual '/delete' $global:netInvocations[0][1]
    Assert-AreEqual $remoteSharePath $global:netInvocations[0][2]

    # A missing connection must not surface as an error, whatever the error preference.
    Microsoft.PowerShell.Management\Remove-Item -Path 'Function:\net'
    Assert-AreEqual 'Application' ((Get-Command net).CommandType.ToString())
    $missingShare = "\\127.0.0.1\wmfc-missing-$([guid]::NewGuid().ToString('N'))"
    $previousErrorActionPreference = $ErrorActionPreference
    try
    {
        foreach($errorPreference in @('Continue', 'Stop'))
        {
            $ErrorActionPreference = $errorPreference
            $cleanupOutput = @(Try-CleanupPSDrive -Path $missingShare 2>&1)
            $ErrorActionPreference = $previousErrorActionPreference
            Assert-AreEqual 0 @($cleanupOutput | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }).Count
        }
    }
    finally
    {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}
finally
{
    foreach($testFunctionName in $testFunctionNames)
    {
        if ($previousTestFunctions.ContainsKey($testFunctionName))
        {
            Set-Item -Path "function:\global:$testFunctionName" -Value $previousTestFunctions[$testFunctionName]
        }
        else
        {
            Microsoft.PowerShell.Management\Remove-Item -Path "function:\global:$testFunctionName" -ErrorAction SilentlyContinue
        }
    }

    Remove-Variable -Name netInvocations -Scope Global -ErrorAction SilentlyContinue
}
