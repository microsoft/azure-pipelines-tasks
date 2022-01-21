[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1

$acceptPlatformCases = 'x86', 'x64', 'Any CPU', 'NewPlatform'

Register-Mock Get-VstsTaskVariable { '' } -- -Name AZURE_HTTP_USER_AGENT

# Act.
foreach ($acceptPlatformCase in $acceptPlatformCases)
{
    $accepted = $false
    try {
        $result = Format-MSBuildArguments -Platform $acceptPlatformCase
        $accepted = $true
    }
    catch {
        Write-Host 'Unexpected Exception:'
        Write-Host $_
    }

    #Assert.
    Assert-AreEqual $true $accepted "Expected the following Platform to be accepted: $acceptPlatformCase"
}

# Arrange.
$acceptConfigurationCases = 'Release', 'Debug', 'DEBUG', 'Any Other Text Not Containing Forbidden Punctuation'

# Act.
foreach ($acceptConfigurationCase in $acceptConfigurationCases)
{
    $accepted = $false
    try {
        $result = Format-MSBuildArguments -Configuration $acceptConfigurationCase
        $accepted = $true
    }
    catch {
        Write-Host 'Unexpected Exception:'
        Write-Host $_
    }

    # Assert.
    Assert-AreEqual $true $accepted "Expected the following Configuration to be accepted: $acceptConfigurationCase"
}

# Arrange.
$rejectCases = 'Release; /Logger:"\\networkshare\\NotActuallyALogger.dll', 'Angle<Braces', 'secarB>elgnA', 'ASTER*SKS', 'AMPER&AND', 'PER%ENT', '"double quotes"', '#HASHTAGS', 'question marks?'

# Act.
foreach ($rejectCase in $rejectCases)
{
    $accepted = $false
    try {
        $result = Format-MSBuildArguments -Platform $rejectCase
        $accepted = $true
    }
    catch {
        
    }

    # Assert.
    Assert-AreEqual $false $accepted "Expected the following Platform to be rejected: $rejectCase"
}

# Act.
foreach ($rejectCase in $rejectCases)
{
    $accepted = $false
    try {
        $result = Format-MSBuildArguments -Configuration $rejectCase
        $accepted = $true
    }
    catch {
        
    }

    # Assert.
    Assert-AreEqual $false $accepted "Expected the following Configuration to be rejected: $rejectCase"
}