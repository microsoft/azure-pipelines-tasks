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

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

. $PSScriptRoot/RoboCopyJob.ps1
. $PSScriptRoot/Utility.ps1

try 
{

    # keep machineNames parameter name unchanged due to back compatibility
    $machineFilter = $machineNames
    $sourcePath = $sourcePath.Trim('"')
    $targetPath = $targetPath.Trim('"')

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

        $machines = $environmentName.split(',') | ForEach-Object { if ($_ -and $_.trim()) { $_.trim() } }

        $secureAdminPassword = ConvertTo-SecureString $adminPassword -AsPlainText -Force
        $machineCredential = New-Object System.Net.NetworkCredential ($adminUserName, $secureAdminPassword)

        if ($machines.Count -eq 0)
        {
            throw (Get-VstsLocString -Key "WFC_NoMachineExistsUnderEnvironment0ForDeployment" -ArgumentList $environmentName)
        }

        if($copyFilesInParallel -eq "false" -or  ( $machines.Count -eq 1 ))
        {
            foreach($machine in $machines)
            {

                Write-Output (Get-VstsLocString -Key "WFC_CopyStartedFor0" -ArgumentList $machine)

                Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $machineCredential, $cleanTargetBeforeCopy, $additionalArguments
            } 
        }
        else
        {
            [hashtable]$Jobs = @{} 

            foreach($machine in $machines)
            {

                Write-Output (Get-VstsLocString -Key "WFC_CopyStartedFor0" -ArgumentList $machine)

                $job = Start-Job -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $machineCredential, $cleanTargetBeforeCopy, $additionalArguments

                $Jobs.Add($job.Id, $machine)
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