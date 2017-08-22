[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

# Get inputs for the task
$environmentName = Get-VstsInput -Name EnvironmentName
$adminUserName = Get-VstsInput -Name AdminUserName
$adminPassword = Get-VstsInput -Name AdminPassword
$resourceFilteringMethod = Get-VstsInput -Name ResourceFilteringMethod
$machineNames = Get-VstsInput -Name MachineNames
$sourcePath = Get-VstsInput -Name SourcePath
$targetPath = Get-VstsInput -Name TargetPath
$additionalArguments = Get-VstsInput -Name AdditionalArguments
$cleanTargetBeforeCopy = Get-VstsInput -Name CleanTargetBeforeCopy
$copyFilesInParallel = Get-VstsInput -Name CopyFilesInParallel

. $PSScriptRoot/RoboCopyJob.ps1
. $PSScriptRoot/Utility.ps1

# Import all the dlls and modules which have cmdlets we need
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Internal.psm1"
Import-Module "$PSScriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"

try 
{

    # keep machineNames parameter name unchanged due to back compatibility
    $machineFilter = $machineNames
    $sourcePath = $sourcePath.Trim('"')
    $targetPath = $targetPath.Trim('"')

    # Default + constants #
    $resourceFQDNKeyName = Get-ResourceFQDNTagKey

    $envOperationStatus = 'Passed'

    Validate-SourcePath $sourcePath
    Validate-DestinationPath $targetPath $environmentName

    if([string]::IsNullOrWhiteSpace($environmentName))
    {
        Write-Verbose "No environment found. Copying to destination."

        Write-Output (Get-VstsLocString -Key "Copy started for - '{0}'" -ArgumentList $targetPath)
        Copy-OnLocalMachine -sourcePath $sourcePath -targetPath $targetPath -adminUserName $adminUserName -adminPassword $adminPassword `
                            -cleanTargetBeforeCopy $cleanTargetBeforeCopy -additionalArguments $additionalArguments
        Write-Verbose "Files copied to destination successfully."
    }
    else
    {

        Write-Verbose "Starting Register-Environment cmdlet call for environment : $environmentName with filter $machineFilter"
         $environment = Register-Environment -EnvironmentName $environmentName -EnvironmentSpecification $environmentName -UserName $adminUserName -Password $adminPassword -ResourceFilter $machineFilter
        Write-Verbose "Completed Register-Environment cmdlet call for environment : $environmentName"

        $fetchedEnvironmentName = $environment.Name

        Write-Verbose "Starting Get-EnvironmentResources cmdlet call on environment name: $fetchedEnvironmentName"
        $resources = Get-EnvironmentResources -Environment $environment
        Write-Verbose "Completed Get-EnvironmentResources cmdlet call for environment name: $fetchedEnvironmentName"

        if ($resources.Count -eq 0)
        {
            throw (Get-VstsLocString -Key "WFC_NoMachineExistsUnderEnvironment0ForDeployment" -ArgumentList $environmentName)
        }

        $resourcesPropertyBag = Get-ResourcesProperties -envName $fetchedEnvironmentName -resources $resources

        if($copyFilesInParallel -eq "false" -or  ( $resources.Count -eq 1 ))
        {
            foreach($resource in $resources)
            {
                $resourceProperties = $resourcesPropertyBag.Item($resource.Id)
                $machine = $resourceProperties.fqdn        

                Write-Output (Get-VstsLocString -Key "WFC_CopyStartedFor0" -ArgumentList $machine)

                Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $additionalArguments
            } 
        }
        else
        {
            [hashtable]$Jobs = @{} 

            foreach($resource in $resources)
            {
                $resourceProperties = $resourcesPropertyBag.Item($resource.Id)

                $machine = $resourceProperties.fqdn        

                Write-Output (Get-VstsLocString -Key "WFC_CopyStartedFor0" -ArgumentList $machine)

                $job = Start-Job -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $resourceProperties.credential, $cleanTargetBeforeCopy, $additionalArguments

                $Jobs.Add($job.Id, $resourceProperties)
            }        

            While ($Jobs.Count -gt 0)
            {
                Start-Sleep 10 
                foreach($job in Get-Job)
                {
                    if($Jobs.ContainsKey($job.Id) -and $job.State -ne "Running")
                    {
                        Receive-Job -Id $job.Id
                        Remove-Job $Job                 
                        $Jobs.Remove($job.Id)
                    } 
                }
            }
        }
    }

}
catch
{
    Write-Verbose $_.Exception.ToString() -Verbose
    throw
}
finally
{
    Trace-VstsLeavingInvocation $MyInvocation
}