[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\CommonFunctions.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\PublishFunctions.ps1
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$pdbFiles = @( )
$product = 'Some product'
$version = 'Some version'
$maximumWaitTime = [timespan]::FromSeconds(2)
$semaphoreMessage = 'Some semaphore message'
$artifactName = 'Some artifact name'
Register-Mock Write-Warning
Register-Mock New-ResponseFile { throw 'Should not reach here.' }
Register-Mock Write-VstsAssociateArtifact
try {
    $null = [System.IO.Directory]::CreateDirectory($share)

    # Act.
    Invoke-PublishSymbols -PdbFiles $pdbFiles -Share $share -Product $product -Version $version -MaximumWaitTime $maximumWaitTime -SemaphoreMessage $semaphoreMessage -ArtifactName $artifactName

    # Assert.
    Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*NoFilesForPublishing*' }
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}