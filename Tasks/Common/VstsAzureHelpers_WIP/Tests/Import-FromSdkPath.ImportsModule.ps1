[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$variableSets = @(
    @{
        Classic = $true
        ProgramFilesX86Defined = $true
        FoundInProgramFilesX86 = $true
        FoundInProgramFiles = $false
    }
    @{
        Classic = $true
        ProgramFilesX86Defined = $true
        FoundInProgramFilesX86 = $false
        FoundInProgramFiles = $true
    }
    @{
        Classic = $true
        ProgramFilesX86Defined = $true
        FoundInProgramFilesX86 = $true
        FoundInProgramFiles = $true
    }
    @{
        Classic = $false
        ProgramFilesX86Defined = $true
        FoundInProgramFilesX86 = $true
        FoundInProgramFiles = $false
    }
    @{
        Classic = $false
        ProgramFilesX86Defined = $true
        FoundInProgramFilesX86 = $false
        FoundInProgramFiles = $true
    }
    @{
        Classic = $false
        ProgramFilesX86Defined = $true
        FoundInProgramFilesX86 = $true
        FoundInProgramFiles = $true
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Test-Path
    Unregister-Mock Import-Module

    # Setup the expected partial path.
    if ($variableSet.Classic) {
        $partialPath = 'Microsoft SDKs\Azure\PowerShell\ServiceManagement\Azure\Azure.psd1'
    } else {
        $partialPath = 'Microsoft SDKs\Azure\PowerShell\ResourceManager\AzureResourceManager\AzureRM.Profile\AzureRM.Profile.psd1'
    }

    # Setup the Program Files environment variables.
    $env:ProgramFiles = 'program files'
    if ($variableSet.ProgramFilesX86Defined) {
        ${env:ProgramFiles(x86)} = 'wow program files' # Windows on Windows.
    } else {
        ${env:ProgramFiles(x86)} = ''
    }

    # Setup the PSD1 paths.
    $wowPsd1 = [System.IO.Path]::Combine(${env:ProgramFiles(x86)}, $partialPath)
    $psd1 = [System.IO.Path]::Combine($env:ProgramFiles, $partialPath)

    # Setup Test-Path.
    if ($variableSet.FoundInProgramFilesX86) {
        Register-Mock Test-Path { $true } -- -LiteralPath $wowPsd1 -PathType Leaf
    }

    if ($variableSet.FoundInProgramFiles) {
        Register-Mock Test-Path { $true } -- -LiteralPath $psd1 -PathType Leaf
    }

    # Setup Import-Module.
    if ($variableSet.FoundInProgramFilesX86) {
        $expectedModule = @{ Version = [version]'1.2.3.4' }
        Register-Mock Import-Module { $expectedModule } -Name $wowPsd1 -Global -PassThru -Force
    }

    if ($variableSet.FoundInProgramFiles) {
        $expectedModule = @{ Version = [version]'2.3.4.5' }
        Register-Mock Import-Module { $expectedModule } -Name $psd1 -Global -PassThru -Force
    }

    if($variableSet.Classic -eq $false) {
        Register-Mock Import-AzureRmSubmodulesFromSdkPath
    }
    # Clear the private module variables.
    & $module { $script:azureModule = $null ; $script:azureRMProfileModule = $null }

    # Act.
    $result = & $module Import-FromSdkPath -Classic:($variableSet.Classic)

    # Assert.
    Assert-AreEqual $true $result
    if ($variableSet.FoundInProgramFilesX86) {
        Assert-WasCalled Import-Module -- -Name $wowPsd1 -Global -PassThru -Force
    } else {
        Assert-WasCalled Import-Module -- -Name $psd1 -Global -PassThru -Force
    }

    if ($variableSet.Classic) {
        Assert-AreEqual $expectedModule (& $module { $script:azureModule })
    } else {
        Assert-AreEqual $expectedModule (& $module { $script:azureRMProfileModule })
    }
}
