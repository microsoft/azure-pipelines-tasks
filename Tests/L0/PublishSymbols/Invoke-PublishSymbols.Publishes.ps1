[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\CommonFunctions.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\PublishFunctions.ps1
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$pdbFiles = 'Some PDB file 1', 'Some PDB file 2'
$product = 'Some product'
$version = 'Some version'
$maximumWaitTime = [timespan]::FromSeconds(2)
$semaphoreMessage = 'Some semaphore message'
$artifactName = 'Some artifact name'
$responseFile = "$share\responseFile.txt"
Register-Mock New-ResponseFile { [System.IO.File]::WriteAllText($responseFile, 'Some response file content') ; $responseFile }
$semaphore = New-Object psobject
Register-Mock Lock-Semaphore { $semaphore }
Register-Mock Get-SymStorePath { 'Some path to symstore.exe' }
Register-Mock Invoke-VstsTool
Register-Mock Get-LastTransactionId { 'Some last transaction ID' }
Register-Mock Unlock-Semaphore
Register-Mock Get-ArtifactName { 'Some different artifact name' }
Register-Mock Write-VstsAssociateArtifact
try {
    $null = [System.IO.Directory]::CreateDirectory($share)

    # Act.
    Invoke-PublishSymbols -PdbFiles $pdbFiles -Share $share -Product $product -Version $version -MaximumWaitTime $maximumWaitTime -SemaphoreMessage $semaphoreMessage -ArtifactName $artifactName

    # Assert.
    Assert-WasCalled New-ResponseFile -- -PdbFiles $pdbFiles
    Assert-WasCalled Lock-Semaphore -Share $share -MaximumWaitTime ([timespan]::FromMinutes(1)) -SemaphoreMessage $semaphoreMessage
    Assert-WasCalled Invoke-VstsTool -- -FileName 'Some path to symstore.exe' -Arguments "add /f ""@$responseFile"" /s ""$share"" /t ""$product"" /v ""$version""" -WorkingDirectory ([System.IO.Path]::GetTempPath())
    Assert-WasCalled Get-LastTransactionId -- -Share $share
    Assert-WasCalled Unlock-Semaphore -- $semaphore
    Assert-WasCalled Get-ArtifactName -- -ArtifactName $artifactName -LastTransactionId 'Some last transaction ID'
    Assert-WasCalled Write-VstsAssociateArtifact -ParametersEvaluator {
        $Name -eq 'Some different artifact name' -and
        $Path -eq $share -and
        $Type -eq 'SymbolStore' -and
        $Properties['TransactionId'] -eq 'Some last transaction ID'
    }
    Assert-AreEqual $false (Test-Path -LiteralPath $responseFile)
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}