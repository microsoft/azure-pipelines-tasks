[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Get-VstsBuild.psm1"

$tempRoot = "$PSScriptRoot\workInjectionBuild"
$dropRoot = "$tempRoot\drop"
$buildNumber = '20261021.1##vso[task.setvariable variable=B1]x'
$artifactName = 'drop##vso[task.setvariable variable=B2]x'

try
{
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

    Register-Mock Get-VstsEndpoint { @{ url = 'https://example.test/'; auth = @{ parameters = @{ AccessToken = 'token' } } } } -- -Name SystemVssConnection -Require
    Register-Mock Get-VstsTaskVariable { 'project' } -- -Name System.TeamProjectId -Require
    Register-Mock Get-VstsTaskVariable { '7' } -- -Name System.DefinitionId -Require
    Register-Mock Invoke-RestMethod { @{ Value = @(@{ buildNumber = $BuildNumberUnderTest; Id = 42 }) } } -ArgumentsEvaluator { $args[1] -match '/_apis/build/builds\?' }
    Register-Mock Invoke-RestMethod { $ArtifactUnderTest } -ArgumentsEvaluator { $args[1] -match '/artifacts\?' }
    Register-Mock Get-TempDirectoryPath { $tempRoot }
    Register-Mock Get-FileWithProgress
    Register-HostCapture

    # Act 1: the previous build number is logged and the artifact is a file share.
    $BuildNumberUnderTest = $buildNumber
    $ArtifactUnderTest = @{ resource = @{ type = 'filepath'; data = $dropRoot } }
    $null = Get-VstsBuild -PkgArtifactName $artifactName -OverwritePkgArtifact $false -CompareType LastSuccessful

    # Act 2: the artifact name is logged when the artifact is downloaded. Extracting the stubbed download throws.
    $BuildNumberUnderTest = '20261021.2'
    $ArtifactUnderTest = @{ resource = @{ type = 'container'; downloadUrl = 'https://example.test/artifact.zip' } }
    try
    {
        $null = Get-VstsBuild -PkgArtifactName $artifactName -OverwritePkgArtifact $true -CompareType LastSuccessful
    }
    catch
    {
        Write-Verbose "Expected failure after the download was logged: $($_.Exception.Message)"
    }

    # Assert
    Assert-NoLiveLoggingCommands
    Assert-LogLineWritten 'PreviousBuildNumberLabel 20261021.1##_vso[task.setvariable variable=B1]x'
    Assert-LogLineWritten 'DownloadingArtifact drop##_vso[task.setvariable variable=B2]x'
    Assert-LogLineWritten 'FinishedDownloadingArtifact drop##_vso[task.setvariable variable=B2]x'
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $tempRoot -ErrorAction SilentlyContinue
}
