[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1

$repositoryRoot = Resolve-Path "$PSScriptRoot\..\..\..\.."
$taskScripts = @(
    "Tasks\AzureFileCopyV1\AzureFileCopy.ps1",
    "Tasks\AzureFileCopyV2\AzureFileCopy.ps1",
    "Tasks\AzureFileCopyV3\AzureFileCopy.ps1",
    "Tasks\AzureFileCopyV4\AzureFileCopy.ps1",
    "Tasks\AzureFileCopyV5\AzureFileCopy.ps1",
    "Tasks\AzureFileCopyV6\AzureFileCopy.ps1",
    "Tasks\AzurePowerShellV2\AzurePowerShell.ps1",
    "Tasks\AzureCloudPowerShellDeploymentV1\Publish-AzureCloudDeployment.ps1",
    "Tasks\AzureCloudPowerShellDeploymentV2\Publish-AzureCloudDeployment.ps1"
)
$initializerNames = @("Initialize-Azure", "Initialize-AzModule", "Initialize-AzureRMModule")

foreach ($relativePath in $taskScripts) {
    $taskScript = Join-Path $repositoryRoot $relativePath
    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($taskScript, [ref]$tokens, [ref]$parseErrors)

    Assert-AreEqual 0 $parseErrors.Count "Task script should parse: $relativePath"

    $initializers = $ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.CommandAst] -and
            $initializerNames -contains $node.GetCommandName()
    }, $true)

    Assert-AreEqual $false ($initializers.Count -eq 0) "Expected an Azure initializer in $relativePath"

    foreach ($initializer in $initializers) {
        $cleanupGuaranteed = $false
        $ancestor = $initializer.Parent

        while ($ancestor) {
            if ($ancestor -is [System.Management.Automation.Language.TryStatementAst] -and
                $ancestor.Finally -and
                $ancestor.Finally.Extent.Text -match '\bRemove-EndpointSecrets\b') {
                $cleanupGuaranteed = $true
                break
            }

            $ancestor = $ancestor.Parent
        }

        Assert-AreEqual $true $cleanupGuaranteed "$($initializer.GetCommandName()) must be protected by a finally block that calls Remove-EndpointSecrets in $relativePath"
    }
}