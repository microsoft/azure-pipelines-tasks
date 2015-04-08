param(
    [string] $uncPathLocation
)

Write-Host "Entering script PublishSymbolsUnc.ps1"
Write-Host "uncPathLocation = $uncPathLocation"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$uncPathLocation)
{
    throw "uncPathLocation parameter not set on script"
}
Write-Host "Verify that uncPathLocation exists"

#TODO: ??? - $timeline = Start-Timeline -Context $distributedTaskContext

Write-Host "Get some values off of the $distributedTaskContext"
#$cwd = Get-Location  
#$projectName = Get-Variable -Context $distributedTaskContext -Name "System.TeamProject"
#$buildDir = Get-Variable -Context $distributedTaskContext -Name "Agent.BuildDirectory" -Global $FALSE
#$buildNumber = Get-Variable -Context $distributedTaskContext -Name "Build.BuildNumber"
#$buildUri = Get-Variable -Context $distributedTaskContext -Name "Build.BuildUri"	



Write-Host "START: Indexing Sources..."
Write-Host "Find ToolPath to pdbstr.exe"

Write-Host "Find all PDB files starting at sourceFolder"
# Find all PDB files starting at sourceFolder
## Call Find-Files
#    $pkgConfig = Find-Files -SearchPattern "$slnFolder\**\packages.config"

Write-Host "For each pdb file..."
Write-Host "Call GetReferencedSourceFiles (NativeMethods)"
Write-Host "For TfGit: CreateSrcSrvString(...)"
Write-Host "For Tfvc: CreateSrcSrvString(...)"
Write-Host "Invoke process for pdbstr.exe"
Write-Host "END: Indexing Sources..."

Write-Host "START: Publishing Symbols..."
Write-Host "Find ToolPath to symstore.exe"
Write-Host "Write .rsp file for symstore.exe to use"
Write-Host "TODO: Need SharedResourceScope equivalent"
Write-Host "Invoke process for symstore.exe"
Write-Host "TODO: Need UncEndpoint (using path, credentials)"
Write-Host "END: Publishing Symbols..."

Write-Host "Leaving script PublishSymbolsUnc.ps1"

