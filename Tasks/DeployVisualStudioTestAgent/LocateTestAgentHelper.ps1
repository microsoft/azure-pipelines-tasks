function Locate-TestAgent($ProductVersion = "14.0")
{
    Write-Verbose "Locating Test Agent: $ProductVersion" -verbose
    $testAgentDetails = @{}
    $version = $null
    $path = $null

    #Find the latest version
    $regPath = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing"
    if (-not (Test-Path $regPath))
    {
        $regPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\DevDiv\vstf\Servicing"
    }
    if (Test-Path $regPath)
    {
        $keys = Get-ChildItem $regPath | Where-Object {$_.GetSubKeyNames() -contains "testagentcore"}
        $version = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending | Select-Object -First 1
        $path = $regPath + "\" + $version + "\" + "testagentcore"
    }

    if (-not $version)
    {
        $specificVersionPath = ("HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing\{0}\testagentcore" -f $ProductVersion)
        if(Test-Path $specificVersionPath)
        {
            $version = $ProductVersion
            $path = $specificVersionPath
        }
    }

    Write-Verbose "Probed Test Agent: $version Path: $path" -verbose
    $testAgentDetails.Version=$version
    $testAgentDetails.Path=$path

    return $testAgentDetails;
}

function Locate-TestVersion($ProductVersion = "14.0"){
    $testAgent = Locate-TestAgent($ProductVersion)
    if($testAgent)
    {
        return $testAgent.Version
    }
    return $null
}

function Get-SubKeysInFloatFormat($keys)
{
    $targetKeys = @()      # New array
    foreach ($key in $keys)
    {
        $targetKeys += [decimal] $key.PSChildName
    }

    return $targetKeys
}

function Locate-TestAgentPath($ProductVersion = "14.0")
{
    $avlVersion = Locate-TestVersion
    if($avlVersion)
    {
        $ProductVersion = $avlVersion
    }
    Write-Verbose "VS Agent version $ProductVersion" -verbose

    $testAgentPath = "HKLM:\SOFTWARE\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools" -f $ProductVersion

    if ((Test-Path $testAgentPath) -and (Get-Item $testAgentPath).GetValue('InstallDir'))
    {
        return $testAgentPath;
    }

    $testAgentPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools" -f $ProductVersion
    if ((Test-Path $testAgentPath) -and (Get-Item $testAgentPath).GetValue('InstallDir'))
    {
        return $testAgentPath;
    }

    Write-Verbose "Test Agent doesn't exist as Path doesn't exist" -verbose
    return $null;
}
